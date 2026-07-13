import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getEpisodePlayData, getEpisodeLanguages, getEpisodeStreams, getTrending } from '../api/anime'
import { extractErrorMessage } from '../api/client'
import { getResume, saveResume } from '../api/watchHistory'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAnime, useEpisodes, useSync } from '../hooks/useWatch'
import EpisodePanel from '../components/watch/EpisodePanel'
import AnimeInfo from '../components/watch/AnimeInfo'
import AutoNextOverlay from '../components/watch/AutoNextOverlay'
import RelatedAnime from '../components/watch/RelatedAnime'
import { useAuth } from '../context/AuthContext'

const VideoPlayer = lazy(() => import('../components/watch/VideoPlayer'))

const LANG_KEY = 'aw_language'

function LoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 space-y-4">
          <div className="w-full aspect-video bg-white/5 rounded-xl animate-pulse" />
          <div className="h-8 bg-white/5 rounded-lg w-3/4 animate-pulse" />
          <div className="h-4 bg-white/5 rounded-lg w-1/2 animate-pulse" />
          <div className="h-32 bg-white/5 rounded-xl animate-pulse" />
        </div>
        <div className="w-full lg:w-80 space-y-3">
          <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}

function ErrorDisplay({ message, onRetry, slug, malId }) {
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-white text-lg font-bold mb-2">Something went wrong</h2>
        <p className="text-muted text-sm mb-4">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={onRetry} className="bg-primary/20 hover:bg-primary/30 text-primary text-sm font-medium px-5 py-2 rounded-lg transition-all">
            Try Again
          </button>
          <Link to={slug ? `/anime/${slug}` : malId ? `/anime/${malId}` : '/browse'} className="text-white/60 hover:text-white text-sm font-medium px-5 py-2 rounded-lg border border-white/10 hover:border-white/20 transition-all">
            Back to Anime
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function WatchPage() {
  const { malId: paramMalId, episodeNumber: paramEpisode, slug: paramSlug, episode: paramEp } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const slug = paramSlug || null
  const malId = paramMalId ? Number(paramMalId) : null
  const initialEp = Number(paramEpisode || paramEp || 1)

  const [currentEp, setCurrentEp] = useState(initialEp)
  const [embedUrl, setEmbedUrl] = useState('')
  const [embedType, setEmbedType] = useState('hls')
  const [embedLoading, setEmbedLoading] = useState(false)
  const [embedErr, setEmbedErr] = useState(null)
  const [selectedLanguage, setSelectedLanguage] = useState(null)
  const [autoNextVisible, setAutoNextVisible] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [streamKey, setStreamKey] = useState(0)
  const streamsCache = useRef(null)
  const serverFailoverIdx = useRef(0)
  const retryCount = useRef(0)
  const progressRef = useRef({ currentTime: 0, duration: 0 })
  const streamReqId = useRef(0)
  const abortRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const animeQ = useAnime(malId, slug)
  const anime = animeQ.data
  const resolvedMalId = anime?.malId || malId

  const episodesQ = useEpisodes(resolvedMalId)
  const { syncing, error: syncErr, retry: retrySync } = useSync(resolvedMalId, episodesQ.data, episodesQ.isLoading)
  const episodes = episodesQ.data ?? []
  const loading = animeQ.isLoading
  const resolvedSlug = anime?.slug || slug

  const currentEpisode = useMemo(() =>
    episodes.find(e => e.episodeNumber === currentEp), [episodes, currentEp])
  const nextEpisode = useMemo(() =>
    episodes.find(e => e.episodeNumber === currentEp + 1), [episodes, currentEp])
  const prevEpisode = useMemo(() =>
    episodes.find(e => e.episodeNumber === currentEp - 1), [episodes, currentEp])

  useDocumentTitle(anime ? `${anime.title} - Episode ${currentEp}` : 'Loading...')

  useEffect(() => {
    setCurrentEp(Number(paramEpisode || paramEp || 1))
  }, [paramEpisode, paramEp])

  useEffect(() => {
    if (!anime || !resolvedMalId) return
    if (anime.comingSoon) {
      navigate(`/coming-soon/${resolvedMalId}`, { replace: true })
    }
  }, [anime, resolvedMalId, navigate])

  // ---- Combined languages + streams fetch ----
  const playDataQ = useQuery({
    queryKey: ['play', resolvedMalId, currentEpisode?.embedUrl],
    queryFn: ({ signal }) => getEpisodePlayData(resolvedMalId, currentEpisode.embedUrl, signal),
    enabled: !!resolvedMalId && !!currentEpisode?.embedUrl,
    staleTime: 120000,
    retry: 1,
  })
  const { refetch: refetchPlayData } = playDataQ

  const availableLanguages = playDataQ.data?.availableLanguages || []
  const hasSub = availableLanguages.includes('SUB')
  const hasDub = availableLanguages.includes('DUB')
  const languagesLoaded = playDataQ.isSuccess && availableLanguages.length > 0

  // Process play data and auto-select language
  useEffect(() => {
    const playData = playDataQ.data
    if (!playData) return

    if (!playData.languages?.length) {
      setEmbedErr('No stream sources available.')
      setEmbedLoading(false)
      return
    }

    setEmbedType(playData.type || 'hls')
    streamsCache.current = playData
    serverFailoverIdx.current = 0
    retryCount.current = 0

    const saved = localStorage.getItem(LANG_KEY)
    const lang = saved && availableLanguages.includes(saved)
      ? saved
      : hasDub && !hasSub ? 'DUB' : 'SUB'
    setSelectedLanguage(lang)

    const langGroup = playData.languages.find(g => g.language === lang) || playData.languages[0]
    const servers = langGroup?.servers || []
    const best = servers.find(s => s.verified && s.status === 'online') || servers[0]

    if (best) {
      setEmbedUrl(best.proxyUrl || best.url)
      setStreamKey(k => k + 1)
      setEmbedLoading(false)
      setEmbedErr(null)
    } else {
      setEmbedErr('No working servers found.')
      setEmbedLoading(false)
    }
  }, [playDataQ.data, availableLanguages, hasSub, hasDub])

  // ---- Player lifecycle ----
  const handlePlayerReady = useCallback(() => {
    if (mountedRef.current) {
      setEmbedLoading(false)
    }
  }, [])

  const handlePlayerError = useCallback((errorMsg) => {
    if (!mountedRef.current) return
    setEmbedLoading(false)

    const cache = streamsCache.current
    if (!cache?.languages?.length) {
      setEmbedErr('Stream temporarily unavailable.')
      return
    }

    const langGroup = cache.languages.find(g => g.language === selectedLanguage) || cache.languages[0]
    const servers = langGroup?.servers || []

    // Try next verified server from cache
    const nextIdx = serverFailoverIdx.current + 1
    const next = servers.slice(nextIdx).find(s => s.verified && s.status === 'online')
    if (next) {
      serverFailoverIdx.current = servers.indexOf(next)
      setEmbedUrl(next.proxyUrl || next.url)
      setEmbedErr(null)
      setEmbedLoading(true)
      setStreamKey(k => k + 1)
      return
    }

    // Retry with fresh data from backend
    if (retryCount.current < 2 && selectedLanguage && currentEpisode?.embedUrl) {
      retryCount.current++
      serverFailoverIdx.current = 0
      refetchPlayData()
      return
    }

    setEmbedErr('Stream temporarily unavailable.')
  }, [selectedLanguage, currentEpisode?.embedUrl, refetchPlayData])

  // ---- Language switching ----
  const handleLanguageChange = useCallback((lang) => {
    if (lang === selectedLanguage) return
    localStorage.setItem(LANG_KEY, lang)

    const { currentTime, duration } = progressRef.current
    if (currentTime > 0 && duration > 0 && currentEpisode && resolvedMalId) {
      try {
        localStorage.setItem(`aw_resume_${resolvedMalId}_${currentEp}`, String(currentTime))
      } catch {}
    }

    // Switch stream from cache — no new API call needed
    const cache = streamsCache.current
    if (cache?.languages) {
      const langGroup = cache.languages.find(g => g.language === lang) || cache.languages[0]
      const servers = langGroup?.servers || []
      const best = servers.find(s => s.verified && s.status === 'online') || servers[0]
      if (best) {
        setEmbedUrl(best.proxyUrl || best.url)
        setEmbedErr(null)
        setStreamKey(k => k + 1)
      }
    }
    setSelectedLanguage(lang)
  }, [selectedLanguage, currentEpisode, resolvedMalId, currentEp])

  // ---- Navigation ----
  const handleNext = useCallback(() => {
    if (nextEpisode) {
      setAutoNextVisible(false)
      const targetSlug = resolvedSlug || resolvedMalId
      navigate(`/anime/${targetSlug}/ep/${currentEp + 1}`, { replace: true })
    }
  }, [nextEpisode, resolvedSlug, resolvedMalId, currentEp, navigate])

  const handlePrev = useCallback(() => {
    if (currentEp > 1) {
      setAutoNextVisible(false)
      const targetSlug = resolvedSlug || resolvedMalId
      navigate(`/anime/${targetSlug}/ep/${currentEp - 1}`, { replace: true })
    }
  }, [resolvedSlug, resolvedMalId, currentEp, navigate])

  const handleEpisodeSelect = useCallback((ep) => {
    setAutoNextVisible(false)
    setCurrentEp(ep.episodeNumber)
    streamsCache.current = null
    serverFailoverIdx.current = 0
    retryCount.current = 0
    setEmbedUrl('')
    setEmbedErr(null)
    const targetSlug = resolvedSlug || resolvedMalId
    navigate(`/anime/${targetSlug}/ep/${ep.episodeNumber}`, { replace: true })
  }, [resolvedSlug, resolvedMalId, navigate])

  const handleEnded = useCallback(() => {
    if (nextEpisode) setAutoNextVisible(true)
  }, [nextEpisode])

  const handleCancelAutoNext = useCallback(() => setAutoNextVisible(false), [])

  const handleRetryEmbed = useCallback(() => {
    if (selectedLanguage && currentEpisode?.embedUrl) {
      retryCount.current = 0
      serverFailoverIdx.current = 0
      refetchPlayData()
    }
  }, [selectedLanguage, currentEpisode?.embedUrl, refetchPlayData])

  const handleTimeUpdate = useCallback(({ currentTime, duration }) => {
    progressRef.current = { currentTime, duration }
  }, [])

  // ---- Resume logic ----
  useEffect(() => {
    if (!resolvedMalId) return
    getResume(resolvedMalId).then(resume => {
      if (resume?.available && resume.episodeNumber) {
        if (!paramEpisode && !paramEp) {
          const targetSlug = resolvedSlug || resolvedMalId
          navigate(`/anime/${targetSlug}/ep/${resume.episodeNumber}`, { replace: true })
        }
      }
    }).catch(() => {})
  }, [resolvedMalId, paramEpisode, paramEp, navigate, resolvedSlug])

  useEffect(() => {
    if (!resolvedMalId || !user) return
    const interval = setInterval(() => {
      const { currentTime, duration } = progressRef.current
      if (currentTime > 0 && duration > 0) {
        saveResume(resolvedMalId, {
          episodeNumber: currentEp,
          progressSeconds: Math.floor(currentTime),
          durationSeconds: Math.floor(duration),
          animeTitle: anime?.title || '',
          animeImage: anime?.imageUrl || '',
        }).catch(() => {})
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [resolvedMalId, currentEp, user, anime])

  useEffect(() => {
    if (anime && currentEp) {
      try {
        const existing = JSON.parse(localStorage.getItem('aw_continue') || '[]')
        const filtered = existing.filter(e => e.malId !== Number(resolvedMalId))
        filtered.unshift({
          malId: Number(resolvedMalId),
          slug: resolvedSlug,
          title: anime.title,
          image: anime.imageUrl,
          episode: currentEp,
          timestamp: Date.now()
        })
        localStorage.setItem('aw_continue', JSON.stringify(filtered.slice(0, 20)))
      } catch {}
    }
  }, [resolvedMalId, resolvedSlug, anime, currentEp])

  const trendingQ = useQuery({
    queryKey: ['trending', 1],
    queryFn: ({ signal }) => getTrending(0, 8, signal),
    staleTime: 300000,
  })
  const trending = trendingQ.data?.data ?? []

  if (loading) return <LoadingSkeleton />
  if (animeQ.error) return <ErrorDisplay message={extractErrorMessage(animeQ.error)} onRetry={() => animeQ.refetch()} slug={resolvedSlug} malId={resolvedMalId} />

  return (
    <div className="max-w-7xl mx-auto p-2 sm:p-4 lg:p-6">
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* ===== LEFT COLUMN ===== */}
        <div className="flex-1 min-w-0 space-y-3 sm:space-y-4">

          {/* ---- VIDEO PLAYER ---- */}
          <div className="relative">
            <Suspense fallback={
              <div className="w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-[3px] border-primary/30 border-t-primary rounded-full animate-spin" />
                  <p className="text-white/60 text-xs">Loading player...</p>
                </div>
              </div>
            }>
            <VideoPlayer
              embedUrl={embedUrl}
              poster={anime?.imageUrl}
              animeTitle={anime?.title}
              episodeNumber={currentEp}
              animeId={resolvedMalId}
              onRetry={handleRetryEmbed}
              streamType={embedType}
              onEnded={handleEnded}
              onTimeUpdate={handleTimeUpdate}
              onSwipeUp={handleNext}
              onSwipeDown={handlePrev}
              currentLanguage={selectedLanguage}
              onReady={handlePlayerReady}
              onError={handlePlayerError}
              streamKey={streamKey}
            />
            </Suspense>

            {/* Stream error overlay */}
            {embedErr && !embedLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-sm rounded-xl">
                <div className="text-center max-w-sm px-6">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <p className="text-white text-sm font-medium mb-1">{embedErr}</p>
                  <p className="text-muted text-xs mb-4">The servers may be down or the stream is unavailable.</p>
                  <button onClick={handleRetryEmbed} className="bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium px-4 py-2 rounded-lg transition-all">
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Loading overlay */}
            {embedLoading && !embedErr && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 rounded-xl pointer-events-none">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-[3px] border-primary/30 border-t-primary rounded-full animate-spin" />
                  <p className="text-white/60 text-xs">Resolving stream...</p>
                </div>
              </div>
            )}

            <AutoNextOverlay
              visible={autoNextVisible}
              nextEpisode={nextEpisode}
              animeTitle={anime?.title}
              onPlay={handleNext}
              onCancel={handleCancelAutoNext}
              countdown={10}
            />
          </div>

          {/* ---- SUB / DUB + NAVIGATION ---- */}
          <div className="flex flex-wrap items-center gap-3 justify-between">
            {/* SUB / DUB pills — always visible, language check is immediate */}
            <div className="flex gap-2">
              {['SUB', 'DUB'].map(lang => {
                const available = languagesLoaded ? availableLanguages.includes(lang) : false
                const loadingLangs = playDataQ.isLoading || (!languagesLoaded && !playDataQ.isError)
                return (
                  <button
                    key={lang}
                    onClick={() => available && handleLanguageChange(lang)}
                    disabled={!available || loadingLangs}
                    className={`relative px-5 py-2 text-xs font-bold rounded-full transition-all duration-200 ${
                      loadingLangs
                        ? 'text-white/15 bg-white/[0.02] border border-white/[0.04] cursor-wait'
                        : !available
                          ? 'text-white/15 bg-white/[0.02] border border-white/[0.04] cursor-not-allowed'
                          : selectedLanguage === lang
                            ? 'bg-primary/25 text-primary shadow-lg shadow-primary/10 border border-primary/30 scale-105'
                            : 'text-white/60 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:text-white hover:border-white/20 hover:scale-105'
                    }`}
                  >
                    {lang}
                    {loadingLangs && lang === 'SUB' && (
                      <span className="ml-1.5 inline-block w-2 h-2 border border-current border-t-transparent rounded-full animate-spin" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Prev / Current / Next */}
            <div className="flex items-center gap-2">
              {prevEpisode && (
                <button onClick={handlePrev} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-xs text-muted hover:text-white transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Ep {currentEp - 1}
                </button>
              )}
              <span className="text-xs text-muted px-3 py-1.5 bg-white/5 rounded-lg border border-white/5">
                Episode {currentEp}
                {episodes.length > 0 && <span className="text-muted/50 ml-1">/ {episodes.length}</span>}
              </span>
              {nextEpisode && (
                <button onClick={handleNext} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-xs text-muted hover:text-white transition-all">
                  Ep {currentEp + 1}
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Sync error */}
          {syncErr && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-3">
              <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-amber-400 text-xs flex-1">{syncErr}</p>
              <button onClick={retrySync} className="text-white/60 hover:text-white text-xs font-medium underline">Retry</button>
            </div>
          )}

          {/* ---- MOBILE EPISODE PANEL ---- */}
          <div className="lg:hidden">
            <EpisodePanel
              episodes={episodes}
              currentEp={currentEp}
              onSelect={handleEpisodeSelect}
              syncing={syncing}
              error={syncErr}
              onRetry={retrySync}
              malId={resolvedMalId}
            />
          </div>

          {/* ---- ANIME INFO ---- */}
          <AnimeInfo anime={anime} episodes={episodes} />

          {/* ---- RELATED ANIME (mobile) ---- */}
          <div className="lg:hidden">
            {trending.length > 0 && (
              <RelatedAnime items={trending} title="Trending Now" compact />
            )}
          </div>

          {/* ---- COMMENTS ---- */}
          <div
            onClick={() => setShowComments(!showComments)}
            className="bg-white/[0.03] border border-white/5 rounded-xl p-6 text-center cursor-pointer hover:bg-white/[0.05] transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-2">
              <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-muted text-xs font-medium">Comments</p>
            <p className="text-muted/50 text-[10px] mt-0.5">Share your thoughts about this episode.</p>
          </div>
        </div>

        {/* ===== RIGHT SIDEBAR ===== */}
        <div className="hidden lg:block w-80 flex-shrink-0 space-y-4 lg:sticky lg:top-[88px] lg:self-start">
          <EpisodePanel
            episodes={episodes}
            currentEp={currentEp}
            onSelect={handleEpisodeSelect}
            syncing={syncing}
            error={syncErr}
            onRetry={retrySync}
            malId={resolvedMalId}
          />
          {trending.length > 0 && (
            <RelatedAnime items={trending} title="Trending Now" compact />
          )}
        </div>
      </div>
    </div>
  )
}
