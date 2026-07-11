import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAnimeById, getEpisodes, syncEpisodes, getEpisodeEmbed, getAnimeState, getTrending } from '../api/anime'
import { extractErrorMessage, extractErrorCode } from '../api/client'
import { getResume, saveResume } from '../api/watchHistory'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import VideoPlayer from '../components/watch/VideoPlayer'
import ServerSelector from '../components/watch/ServerSelector'
import EpisodePanel from '../components/watch/EpisodePanel'
import AnimeInfo from '../components/watch/AnimeInfo'
import AutoNextOverlay from '../components/watch/AutoNextOverlay'
import RelatedAnime from '../components/watch/RelatedAnime'
import ImageWithFallback from '../components/ImageWithFallback'

const PROXY_BASE = '/api/stream/proxy'

function wrapProxy(url, referer) {
  if (!url) return ''
  if (url.startsWith(PROXY_BASE)) return url
  return `${PROXY_BASE}?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer || 'https://anineko.to/')}`
}

function useAnimeQuery(malId) {
  return useQuery({
    queryKey: ['anime', malId],
    queryFn: ({ signal }) => getAnimeById(malId, signal),
    enabled: !!malId,
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
    <div className="min-h-screen bg-body pt-16">
      <div className="max-w-[1500px] mx-auto px-4 py-6 animate-pulse">
        <div className="flex gap-6">
          <div className="flex-[7] min-w-0 space-y-4">
            <div className="w-full aspect-video bg-white/5 rounded-xl" />
            <div className="h-10 bg-white/5 rounded-xl" />
            <div className="h-10 bg-white/5 rounded-xl" />
            <div className="h-48 bg-white/5 rounded-xl" />
          </div>
          <div className="flex-[3] hidden lg:block space-y-4">
            <div className="h-96 bg-white/5 rounded-xl" />
            <div className="h-64 bg-white/5 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

function ErrorDisplay({ message, onRetry, malId }) {
  return (
    <div className="min-h-screen bg-body pt-16 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 px-4 text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-white text-xl font-bold">Something went wrong</h2>
        <p className="text-muted text-sm">{message}</p>
        <div className="flex items-center gap-3 mt-2">
          {onRetry && (
            <button onClick={onRetry} className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all">
              Try Again
            </button>
          )}
          <Link to="/browse" className="text-muted hover:text-white text-sm font-medium transition-colors">
            Browse Anime
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function WatchPage() {
  const { malId, episodeNumber } = useParams()
  const navigate = useNavigate()
  const mounted = useRef(true)

  const [currentEp, setCurrentEp] = useState(Number(episodeNumber) || 1)
  const [embedUrl, setEmbedUrl] = useState('')
  const [embedType, setEmbedType] = useState('hls')
  const [embedLoading, setEmbedLoading] = useState(true)
  const [embedErr, setEmbedErr] = useState(null)
  const [servers, setServers] = useState([])
  const [currentServer, setCurrentServer] = useState(null)
  const [autoNextVisible, setAutoNextVisible] = useState(false)
  const progressRef = useRef({ currentTime: 0, duration: 0 })

  const animeQ = useAnimeQuery(malId)
  const episodesQ = useEpisodesQuery(malId)
  const { syncing, syncErr, retry: retrySync } = useSync(malId, episodesQ.data, episodesQ.isLoading)

  const anime = animeQ.data
  const episodes = episodesQ.data ?? []
  const loading = animeQ.isLoading

  const currentEpisode = useMemo(() =>
    episodes.find(e => e.episodeNumber === currentEp), [episodes, currentEp])

  const nextEpisode = useMemo(() =>
    episodes.find(e => e.episodeNumber === currentEp + 1), [episodes, currentEp])

  useDocumentTitle(anime ? `${anime.title} - Episode ${currentEp}` : 'Loading...')

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    setCurrentEp(Number(episodeNumber) || 1)
    setEmbedLoading(true)
    setEmbedErr(null)
    setAutoNextVisible(false)
  }, [episodeNumber, malId])

  useEffect(() => {
    const s = anime?.status?.toUpperCase().replace(/\s+/g, '_') || ''
    if (['COMING_SOON', 'NOT_RELEASED', 'NOT_YET_RELEASED', 'NOT_YET_AIRED'].includes(s)) {
      navigate(`/coming-soon/${malId}`, { replace: true })
      return
    }
    if (!anime) return
    getAnimeState(malId).then(state => {
      if (state?.comingSoon && mounted.current) {
        navigate(`/coming-soon/${malId}`, { replace: true })
      }
    }).catch(() => {})
  }, [anime, malId, navigate])

  const loadEmbed = useCallback(async () => {
    if (episodes.length === 0) {
      if (!syncing) setEmbedErr('No episodes available for this title.')
      return
    }
    const ep = episodes.find(e => e.episodeNumber === currentEp)
    if (!ep?.embedUrl) {
      setEmbedErr('Episode stream URL not available.')
      setEmbedLoading(false)
      return
    }
    setEmbedLoading(true)
    setEmbedErr(null)
    try {
      const payload = await getEpisodeEmbed(malId, ep.embedUrl)
      if (!mounted.current) return
      if (payload?.embedUrl) {
        const ref = payload.referer || 'https://anineko.to/'
        setEmbedUrl(wrapProxy(payload.embedUrl, ref))
        setEmbedType(payload.type || 'hls')
        const serverList = (payload.servers || []).map(s => ({
          ...s,
          url: wrapProxy(s.url, ref),
        }))
        setServers(serverList)
        setCurrentServer(serverList[0] || { url: payload.embedUrl, label: 'Primary' })
      } else {
        setEmbedErr('Could not retrieve stream source.')
        setServers([])
      }
    } catch (err) {
      if (mounted.current) setEmbedErr(extractErrorMessage(err))
    } finally {
      if (mounted.current) setEmbedLoading(false)
    }
  }, [episodes, currentEp, malId, syncing])

  useEffect(() => {
    loadEmbed()
  }, [loadEmbed])

  const handleServerSwitch = useCallback((server) => {
    setCurrentServer(server)
    setEmbedUrl(server.url)
    setEmbedType(server.url?.includes('.m3u8') ? 'hls' : 'iframe')
    setEmbedLoading(false)
    setEmbedErr(null)
  }, [])

  const handleNext = useCallback(() => {
    if (!nextEpisode) return
    setCurrentEp(nextEpisode.episodeNumber)
    window.history.replaceState(null, '', `/watch/${malId}/${nextEpisode.episodeNumber}`)
    setEmbedLoading(true)
    setAutoNextVisible(false)
  }, [nextEpisode, malId])

  const handlePrev = useCallback(() => {
    if (currentEp <= 1) return
    const prev = currentEp - 1
    setCurrentEp(prev)
    window.history.replaceState(null, '', `/watch/${malId}/${prev}`)
    setEmbedLoading(true)
  }, [currentEp, malId])

  const handleEpisodeSelect = useCallback((ep) => {
    setCurrentEp(ep.episodeNumber)
    window.history.replaceState(null, '', `/watch/${malId}/${ep.episodeNumber}`)
    setEmbedLoading(true)
  }, [malId])

  const handleEnded = useCallback(() => {
    if (nextEpisode) {
      setAutoNextVisible(true)
    }
  }, [nextEpisode])

  const handleCancelAutoNext = useCallback(() => {
    setAutoNextVisible(false)
  }, [])

  const handleRetryEmbed = useCallback(() => {
    loadEmbed()
  }, [loadEmbed])

  const handleTimeUpdate = useCallback(({ currentTime, duration }) => {
    progressRef.current = { currentTime, duration }
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      const { currentTime, duration } = progressRef.current
      if (currentTime > 0 && duration > 0) {
        saveResume(malId, {
          episodeNumber: currentEp, progressSeconds: Math.floor(currentTime),
          durationSeconds: Math.floor(duration), animeTitle: anime?.title || '',
          animeImage: anime?.imageUrl || '',
        })
      }
    }, 30000)
    return () => clearInterval(id)
  }, [malId, currentEp, anime?.title, anime?.imageUrl])

  useEffect(() => {
    getResume(malId).then(data => {
      if (data?.episodeNumber && data.episodeNumber > 1 && !episodeNumber) {
        setCurrentEp(data.episodeNumber)
      }
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [malId])

  useEffect(() => {
    if (anime && currentEp) {
      try {
        const data = JSON.parse(localStorage.getItem('aw_continue') || '{}')
        data[malId] = {
          animeId: malId,
          animeTitle: anime.title,
          animeImage: anime.imageUrl,
          episode: currentEp,
          timestamp: Date.now(),
        }
        localStorage.setItem('aw_continue', JSON.stringify(data))
      } catch {}
    }
  }, [anime, malId, currentEp])

  const [recommended, setRecommended] = useState([])
  useEffect(() => {
    const ctrl = new AbortController()
    getTrending(0, 20, ctrl.signal).then(res => {
      if (!ctrl.signal.aborted) {
        setRecommended((res.data || []).filter(a => String(a.malId || a.id) !== String(malId)).slice(0, 8))
      }
    }).catch(() => {})
    return () => ctrl.abort()
  }, [malId])

  if (loading) return <LoadingSkeleton />
  if (!anime && !loading) {
    return <ErrorDisplay message="This anime was not found." malId={malId} />
  }

  return (
    <div className="min-h-screen bg-body">
      {/* Sticky header */}
      <div className="sticky top-16 z-30 bg-body/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1500px] mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            to={`/anime/${malId}`}
            className="text-muted hover:text-white text-sm transition-colors inline-flex items-center gap-1.5 flex-shrink-0 group"
          >
            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline truncate max-w-[200px]">{anime?.title}</span>
            <span className="sm:hidden">Back</span>
          </Link>
          <span className="text-muted/50 text-xs">/</span>
          <span className="text-white text-sm font-medium truncate">Episode {currentEp}</span>
          {currentEpisode?.title && (
            <>
              <span className="text-muted/30 text-xs hidden md:inline">-</span>
              <span className="text-muted text-xs truncate hidden md:inline max-w-[300px]">{currentEpisode.title}</span>
            </>
          )}
          <div className="flex-1" />
          {syncing && (
            <span className="text-xs text-muted flex items-center gap-1.5 flex-shrink-0">
              <span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              Syncing...
            </span>
          )}
          {anime?.type && (
            <span className="text-[10px] bg-primary/15 text-primary font-bold px-2 py-0.5 rounded hidden sm:inline">{anime.type}</span>
          )}
          {anime?.score && (
            <span className="text-[10px] text-yellow-400 flex items-center gap-0.5 hidden sm:inline">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              {anime.score}
            </span>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[1500px] mx-auto px-4 py-4">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left column - Player + Info */}
          <div className="flex-[7] min-w-0 space-y-4">
            {/* Video Player */}
            <div className="relative">
              <VideoPlayer
                embedUrl={embedUrl}
                servers={servers}
                poster={anime?.imageUrl}
                animeTitle={anime?.title}
                episodeNumber={currentEp}
                animeId={malId}
                onRetry={handleRetryEmbed}
                onChangeSource={handleRetryEmbed}
                streamType={embedType}
                onEnded={handleEnded}
                onTimeUpdate={handleTimeUpdate}
                autoNext={true}
                autoPlay={true}
              />
            </div>

            {/* Episode navigation bar */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrev}
                  disabled={currentEp <= 1}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
                  aria-label="Previous episode"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>

                <div className="flex-1 text-center">
                  <span className="text-xs text-white font-medium">
                    Episode {currentEp}
                    {currentEpisode?.title && <span className="text-muted ml-1">- {currentEpisode.title}</span>}
                  </span>
                </div>

                <button
                  onClick={handleNext}
                  disabled={!nextEpisode}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
                  aria-label="Next episode"
                >
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Share / Bookmark bar */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <span className="text-xs text-muted font-medium">
                  <span className="text-white">{episodes.length > 0 ? episodes.length : '?'}</span> Episodes
                </span>
                <div className="h-3 w-px bg-white/10" />
                <span className="text-xs text-muted font-medium">
                  Watching <span className="text-primary">Episode {currentEp}</span>
                </span>
                <div className="flex-1 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <Link
                    to={`/anime/${malId}`}
                    className="text-[11px] text-muted hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5 flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Details
                  </Link>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href).catch(() => {})
                    }}
                    className="text-[11px] text-muted hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5 flex items-center gap-1"
                    title="Copy link"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Share
                  </button>
                </div>
              </div>
            </div>

            {/* Auto-next overlay */}
            {autoNextVisible && (
              <AutoNextOverlay
                visible={autoNextVisible}
                onNext={handleNext}
                onCancel={handleCancelAutoNext}
                nextEpisode={nextEpisode}
              />
            )}

            {/* Server selector (desktop - below player, mobile - above info) */}
            <div className="lg:hidden">
              <ServerSelector
                servers={servers}
                currentServer={currentServer}
                onSwitch={handleServerSwitch}
                loading={embedLoading}
                currentProvider={embedUrl?.includes('gogo') ? 'GoGoAnime' : embedUrl?.includes('anineko') ? 'Anineko' : null}
              />
            </div>

            {/* Sync error */}
            {syncErr && !syncing && episodes.length === 0 && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-red-400 text-sm font-medium mb-1">Episode sync failed</p>
                    <p className="text-red-400/70 text-xs">{syncErr}</p>
                    <button onClick={retrySync} className="mt-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium px-4 py-1.5 rounded-lg transition-colors">
                      Retry
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Anime Info */}
            {anime && (
              <AnimeInfo anime={anime} episodes={episodes} />
            )}

            {/* Related / Recommendations */}
            <RelatedAnime items={recommended} title="Recommendations" malId={malId} compact />
          </div>

          {/* Right sidebar - desktop */}
          <div className="flex-[3] w-full lg:max-w-sm space-y-6 hidden lg:block">
            <div className="sticky top-36 space-y-6">
              <ServerSelector
                servers={servers}
                currentServer={currentServer}
                onSwitch={handleServerSwitch}
                loading={embedLoading}
                currentProvider={embedUrl?.includes('gogo') ? 'GoGoAnime' : embedUrl?.includes('anineko') ? 'Anineko' : null}
              />
              <EpisodePanel
                episodes={episodes}
                currentEp={currentEp}
                onSelect={handleEpisodeSelect}
                syncing={syncing}
                error={syncErr}
                onRetry={retrySync}
                malId={malId}
              />
            </div>
          </div>
        </div>

        {/* Mobile episode panel */}
        <div className="lg:hidden mt-6">
          <EpisodePanel
            episodes={episodes}
            currentEp={currentEp}
            onSelect={handleEpisodeSelect}
            syncing={syncing}
            error={syncErr}
            onRetry={retrySync}
            malId={malId}
          />
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   SIDEBAR EPISODE PANEL (moved to EpisodePanel.jsx)
   SIDEBAR SERVER SELECTOR (moved to ServerSelector.jsx)
   VIDEO PLAYER (moved to VideoPlayer.jsx)
   ANIME INFO (moved to AnimeInfo.jsx)
   AUTO NEXT (moved to AutoNextOverlay.jsx)
   RELATED ANIME (moved to RelatedAnime.jsx)
   ============================================================ */
