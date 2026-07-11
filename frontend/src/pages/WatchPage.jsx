import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAnimeById, getAnimeBySlug, getEpisodes, syncEpisodes, getEpisodeEmbed, getEpisodeStreams, getTrending } from '../api/anime'
import { extractErrorMessage } from '../api/client'
import { getResume, saveResume } from '../api/watchHistory'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import VideoPlayer from '../components/watch/VideoPlayer'
import ServerSelector from '../components/watch/ServerSelector'
import EpisodePanel from '../components/watch/EpisodePanel'
import AnimeInfo from '../components/watch/AnimeInfo'
import AutoNextOverlay from '../components/watch/AutoNextOverlay'
import RelatedAnime from '../components/watch/RelatedAnime'
import ImageWithFallback from '../components/ImageWithFallback'
import { useAuth } from '../context/AuthContext'

const PROXY_BASE = '/api/stream/proxy'

function wrapProxy(url, referer) {
  if (!url) return ''
  if (url.startsWith(PROXY_BASE)) return url
  return `${PROXY_BASE}?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer || 'https://anineko.to/')}`
}

function useAnimeQuery(malId, slug) {
  return useQuery({
    queryKey: ['anime', malId || slug],
    queryFn: ({ signal }) => {
      if (malId) return getAnimeById(malId, signal)
      return getAnimeBySlug(slug, signal)
    },
    enabled: !!malId || !!slug,
    staleTime: 300000,
    retry: 2,
  })
}

function useEpisodesQuery(malId) {
  return useQuery({
    queryKey: ['episodes', malId],
    queryFn: ({ signal }) => getEpisodes(malId, signal),
    enabled: !!malId,
    staleTime: 300000,
    retry: 1,
  })
}

function useSync(malId, episodes, isLoading) {
  const qc = useQueryClient()
  const attempted = useRef(false)
  const [syncing, setSyncing] = useState(false)
  const [syncErr, setSyncErr] = useState(null)

  const doSync = useCallback(async () => {
    if (attempted.current) return
    attempted.current = true
    setSyncing(true)
    setSyncErr(null)
    try {
      const data = await syncEpisodes(malId)
      if (data && data.length > 0) {
        qc.setQueryData(['episodes', malId], data)
      } else {
        setSyncErr('No episodes available from streaming providers.')
      }
    } catch (err) {
      setSyncErr(extractErrorMessage(err))
    } finally {
      setSyncing(false)
    }
  }, [malId, qc])

  useEffect(() => {
    if (episodes?.length === 0 && !isLoading && !syncing && !attempted.current) {
      doSync()
    }
  }, [episodes, isLoading, syncing, doSync])

  const retry = useCallback(() => {
    attempted.current = false
    doSync()
  }, [doSync])

  return { syncing, syncErr, retry }
}

function LoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 animate-pulse space-y-6">
      <div className="w-full aspect-video bg-white/5 rounded-xl" />
      <div className="flex gap-6">
        <div className="flex-1 space-y-4">
          <div className="h-8 bg-white/5 rounded-lg w-3/4" />
          <div className="h-4 bg-white/5 rounded-lg w-1/2" />
          <div className="h-32 bg-white/5 rounded-xl" />
        </div>
        <div className="w-80 space-y-3">
          <div className="h-10 bg-white/5 rounded-lg" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 bg-white/5 rounded-lg" />
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
  const [embedLoading, setEmbedLoading] = useState(true)
  const [embedErr, setEmbedErr] = useState(null)
  const [provider, setProvider] = useState('')
  const [streamsData, setStreamsData] = useState(null)
  const [currentLanguage, setCurrentLanguage] = useState('SUB')
  const [currentServer, setCurrentServer] = useState(null)
  const [currentServerUrl, setCurrentServerUrl] = useState('')
  const [failoverActive, setFailoverActive] = useState(false)
  const [failoverAttempts, setFailoverAttempts] = useState(0)
  const [autoNextVisible, setAutoNextVisible] = useState(false)
  const progressRef = useRef({ currentTime: 0, duration: 0 })
  const embedAbortRef = useRef(null)
  const failoverTimerRef = useRef(null)

  const animeQ = useAnimeQuery(malId, slug)
  const anime = animeQ.data
  const resolvedMalId = anime?.malId || malId

  const episodesQ = useEpisodesQuery(resolvedMalId)
  const { syncing, syncErr, retry: retrySync } = useSync(resolvedMalId, episodesQ.data, episodesQ.isLoading)

  const episodes = episodesQ.data ?? []
  const loading = animeQ.isLoading

  const resolvedSlug = anime?.slug || slug

  const currentEpisode = useMemo(() =>
    episodes.find(e => e.episodeNumber === currentEp), [episodes, currentEp])
  const nextEpisode = useMemo(() =>
    episodes.find(e => e.episodeNumber === currentEp + 1), [episodes, currentEp])

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

  const loadEmbed = useCallback(async (ep) => {
    if (!ep?.embedUrl || !resolvedMalId) return
    embedAbortRef.current?.abort()
    const controller = new AbortController()
    embedAbortRef.current = controller
    setEmbedLoading(true)
    setEmbedErr(null)
    setFailoverActive(false)
    setFailoverAttempts(0)
    setCurrentServer(null)
    setCurrentServerUrl('')

    try {
      const streams = await getEpisodeStreams(resolvedMalId, ep.embedUrl, controller.signal)
      if (!streams) {
        const fallback = await getEpisodeEmbed(resolvedMalId, ep.embedUrl, controller.signal)
        if (fallback) {
          setEmbedUrl(fallback.embedUrl || '')
          setEmbedType(fallback.type || 'hls')
          setProvider(fallback.provider || '')
          setStreamsData(null)
          const defaultServer = fallback.servers?.[0]
          if (defaultServer) {
            setCurrentServer(defaultServer.label || null)
            setCurrentServerUrl(defaultServer.url || '')
          }
        } else {
          setEmbedErr('No stream sources available.')
        }
        setEmbedLoading(false)
        return
      }

      setProvider(streams.provider || '')
      setEmbedType(streams.type || 'hls')
      setStreamsData(streams)

      const subLang = streams.languages?.find(l => l.language === 'SUB')
      const dubLang = streams.languages?.find(l => l.language === 'DUB')
      const defLang = subLang || dubLang || streams.languages?.[0]
      const lang = defLang?.language || 'SUB'
      setCurrentLanguage(lang)

      const langServers = streams.languages?.find(l => l.language === lang)?.servers || []
      const firstOnline = langServers.find(s => s.verified && s.status === 'online')
      const firstAny = langServers[0]

      if (firstOnline || firstAny) {
        const target = firstOnline || firstAny
        setCurrentServer(target.label || '')
        setCurrentServerUrl(target.proxyUrl || target.url || '')
        setEmbedUrl(target.proxyUrl || target.url || '')
      } else {
        setEmbedErr('No working servers found.')
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setEmbedErr(extractErrorMessage(err))
      }
    } finally {
      setEmbedLoading(false)
    }
  }, [resolvedMalId])

  useEffect(() => {
    if (currentEpisode?.embedUrl) loadEmbed(currentEpisode)
  }, [currentEpisode, loadEmbed])

  const handleServerError = useCallback(() => {
    if (!streamsData?.languages) return
    const langServers = streamsData.languages.find(l => l.language === currentLanguage)?.servers || []

    const currentIdx = langServers.findIndex(
      s => s.proxyUrl === currentServerUrl || s.url === currentServerUrl
    )

    if (currentIdx < langServers.length - 1) {
      setFailoverActive(true)
      setFailoverAttempts(p => p + 1)
      const next = langServers.find((s, i) => i > currentIdx && s.verified && s.status === 'online')
      const target = next || langServers[currentIdx + 1]
      if (target) {
        const newUrl = target.proxyUrl || target.url
        setCurrentServer(target.label)
        setCurrentServerUrl(newUrl)
        setEmbedUrl(newUrl)
        setEmbedErr(null)
        setEmbedLoading(true)
        setTimeout(() => setEmbedLoading(false), 100)
      }
    } else {
      const otherLangs = streamsData.languages.filter(l => l.language !== currentLanguage)
      if (otherLangs.length > 0) {
        setEmbedErr(`No working ${currentLanguage} servers found. Try ${otherLangs[0].language}.`)
      } else {
        setEmbedErr('No stream available.')
      }
    }
  }, [streamsData, currentLanguage, currentServerUrl])

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

  const handleServerSwitch = useCallback((server) => {
    if (!server) return
    const newUrl = server.proxyUrl || server.url
    setCurrentServer(server.label)
    setCurrentServerUrl(newUrl)
    setEmbedUrl(newUrl)
    setFailoverActive(false)
    setEmbedLoading(true)
    setEmbedErr(null)
    setTimeout(() => setEmbedLoading(false), 100)
  }, [])

  const handleLanguageChange = useCallback((lang) => {
    if (!streamsData?.languages) return
    setCurrentLanguage(lang)
    const langServers = streamsData.languages.find(l => l.language === lang)?.servers || []
    const firstOnline = langServers.find(s => s.verified && s.status === 'online')
    const target = firstOnline || langServers[0]
    if (target) {
      handleServerSwitch(target)
    } else {
      setEmbedUrl('')
      setEmbedErr(`No servers available for ${lang}`)
    }
  }, [streamsData, handleServerSwitch])

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
    const targetSlug = resolvedSlug || resolvedMalId
    navigate(`/anime/${targetSlug}/ep/${ep.episodeNumber}`, { replace: true })
  }, [resolvedSlug, resolvedMalId, navigate])

  const handleEnded = useCallback(() => {
    if (nextEpisode) setAutoNextVisible(true)
  }, [nextEpisode])

  const handleCancelAutoNext = useCallback(() => setAutoNextVisible(false), [])

  const handleRetryEmbed = useCallback(() => {
    if (currentEpisode?.embedUrl) loadEmbed(currentEpisode)
  }, [currentEpisode, loadEmbed])

  const handleTimeUpdate = useCallback(({ currentTime, duration }) => {
    progressRef.current = { currentTime, duration }
  }, [])

  const currentQuality = useMemo(() => {
    if (!currentServerUrl) return null
    if (currentServerUrl.includes('1080')) return '1080p'
    if (currentServerUrl.includes('720')) return '720p'
    if (currentServerUrl.includes('480')) return '480p'
    return null
  }, [currentServerUrl])

  if (loading) return <LoadingSkeleton />
  if (animeQ.error) return <ErrorDisplay message={extractErrorMessage(animeQ.error)} onRetry={() => animeQ.refetch()} slug={resolvedSlug} malId={resolvedMalId} />

  const showSidebar = !syncing || episodes.length > 0

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Player + Sidebar Row */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Main Player Column */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Video Player */}
          <div className="relative">
            <VideoPlayer
              embedUrl={embedUrl}
              servers={[]}
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
              provider={provider}
              currentServer={currentServer}
              currentLanguage={currentLanguage}
              currentQuality={currentQuality}
            />

            {/* Embedded stream error display */}
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
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={handleRetryEmbed} className="bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium px-4 py-2 rounded-lg transition-all">
                      Retry
                    </button>
                    {streamsData?.languages?.length > 1 && (
                      <button onClick={() => handleLanguageChange(streamsData.languages.find(l => l.language !== currentLanguage)?.language || 'SUB')} className="text-white/60 hover:text-white text-xs font-medium px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 transition-all">
                        Try {streamsData.languages.find(l => l.language !== currentLanguage)?.language || 'SUB'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {embedLoading && !embedErr && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 rounded-xl pointer-events-none">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-[3px] border-primary/30 border-t-primary rounded-full animate-spin" />
                  <p className="text-white/60 text-xs">Resolving stream...</p>
                </div>
              </div>
            )}

            {/* Auto Next Overlay */}
            <AutoNextOverlay
              visible={autoNextVisible}
              nextEpisode={nextEpisode}
              animeTitle={anime?.title}
              onPlay={handleNext}
              onCancel={handleCancelAutoNext}
              countdown={10}
            />
          </div>

          {/* Mobile Server Selector (visible on small screens) */}
          <div className="lg:hidden">
            <ServerSelector
              languages={streamsData?.languages || []}
              currentLanguage={currentLanguage}
              onLanguageChange={handleLanguageChange}
              servers={[]}
              selectedServerUrl={currentServerUrl}
              onServerChange={handleServerSwitch}
              loading={embedLoading}
              failoverActive={failoverActive}
              currentProvider={provider}
            />
          </div>

          {/* Sync Error */}
          {syncErr && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-3">
              <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-amber-400 text-xs flex-1">{syncErr}</p>
              <button onClick={retrySync} className="text-white/60 hover:text-white text-xs font-medium underline">Retry</button>
            </div>
          )}

          {/* Anime Info Section */}
          <AnimeInfo anime={anime} episodes={episodes} />

          {/* Comments Placeholder */}
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6 text-center">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-2">
              <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-muted text-xs font-medium">Comments coming soon.</p>
            <p className="text-muted/50 text-[10px] mt-0.5">Share your thoughts about this episode.</p>
          </div>
        </div>

        {/* Right Sidebar */}
        {showSidebar && (
          <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
            {/* Desktop Server Selector */}
            <div className="hidden lg:block">
              <ServerSelector
                languages={streamsData?.languages || []}
                currentLanguage={currentLanguage}
                onLanguageChange={handleLanguageChange}
                servers={[]}
                selectedServerUrl={currentServerUrl}
                onServerChange={handleServerSwitch}
                loading={embedLoading}
                failoverActive={failoverActive}
                currentProvider={provider}
              />
            </div>

            {/* Episode Panel */}
            <EpisodePanel
              episodes={episodes}
              currentEp={currentEp}
              onSelect={handleEpisodeSelect}
              syncing={syncing}
              error={syncErr}
              onRetry={retrySync}
              malId={resolvedMalId}
            />

            {/* Related / Trending */}
            {trending.length > 0 && (
              <RelatedAnime anime={trending} title="Trending Now" />
            )}
          </div>
        )}
      </div>

      {/* Mobile Episode Panel (at bottom on small screens) */}
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
    </div>
  )
}
