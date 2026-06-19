import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getAnimeById, getEpisodes, syncEpisodes } from '../api/anime'
import { extractErrorMessage } from '../api/client'
import VideoPlayer from '../components/VideoPlayer'
import EpisodeCard from '../components/EpisodeCard'
import { EpisodeSkeleton } from '../components/Skeleton'

const PROXY_BASE = '/api/anime/proxy/animepahe?url='

function useSyncedEpisodes(malId) {
  const [anime, setAnime] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)
  const [syncTick, setSyncTick] = useState(0)
  const mountedRef = useRef(true)
  const syncTimerRef = useRef(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (syncTimerRef.current) clearInterval(syncTimerRef.current)
    }
  }, [malId])

  const fetchData = useCallback(async () => {
    if (!mountedRef.current) return
    setLoading(true)
    setError(null)
    setSyncTick(0)

    const [animeData, eps] = await Promise.all([
      getAnimeById(malId).catch(() => null),
      getEpisodes(malId).catch(() => []),
    ])

    if (!mountedRef.current) return

    if (animeData) {
      setAnime(animeData)
    } else {
      setError('Anime not found')
      setLoading(false)
      return
    }

    const seen = new Set()
    const unique = []
    for (const ep of eps) {
      const key = ep.episodeNumber
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(ep)
      }
    }
    unique.sort((a, b) => a.episodeNumber - b.episodeNumber)

    if (unique.length > 0) {
      setEpisodes(unique)
      setLoading(false)
      return
    }

    setSyncing(true)
    setLoading(false)
    syncTimerRef.current = setInterval(() => {
      setSyncTick((t) => t + 1)
    }, 1000)
    await doSync()
  }, [malId])

  const doSync = useCallback(async () => {
    setError(null)
    setSyncing(true)

    const maxRetries = 2
    let lastError = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (!mountedRef.current) return

      try {
        const synced = await syncEpisodes(malId)
        if (!mountedRef.current) return

        const seen = new Set()
        const unique = []
        for (const ep of synced) {
          const key = ep.episodeNumber
          if (!seen.has(key)) {
            seen.add(key)
            unique.push(ep)
          }
        }
        unique.sort((a, b) => a.episodeNumber - b.episodeNumber)

        if (unique.length > 0) {
          setEpisodes(unique)
          setSyncing(false)
          if (syncTimerRef.current) clearInterval(syncTimerRef.current)
          return
        }

        lastError = 'No episodes returned'
      } catch (err) {
        lastError = err
      }

      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 2000))
      }
    }

    if (!mountedRef.current) return
    const msg = typeof lastError === 'string' ? lastError : extractErrorMessage(lastError)
    setError(msg)
    setSyncing(false)
    if (syncTimerRef.current) clearInterval(syncTimerRef.current)
  }, [malId])

  useEffect(() => { fetchData() }, [fetchData])

  return { anime, episodes, syncing, error, retry: fetchData, loading, syncTick }
}

export default function WatchPage() {
  const { malId, episodeNumber } = useParams()
  const { anime, episodes, syncing, error: fetchError, retry, loading, syncTick } = useSyncedEpisodes(malId)

  const [currentEp, setCurrentEp] = useState(Number(episodeNumber) || 1)
  const [embedUrl, setEmbedUrl] = useState('')

  useEffect(() => {
    setCurrentEp(Number(episodeNumber) || 1)
  }, [episodeNumber])

  useEffect(() => {
    if (episodes.length === 0) {
      setEmbedUrl('')
      return
    }
    const ep = episodes.find((e) => e.episodeNumber === currentEp) || episodes[0]
    if (ep?.embedUrl) {
      setEmbedUrl(PROXY_BASE + encodeURIComponent(ep.embedUrl))
    } else {
      setEmbedUrl('')
    }
  }, [episodes, currentEp])

  const handleEpisodeSelect = (ep) => {
    setCurrentEp(ep.episodeNumber)
    window.history.replaceState(null, '', `/watch/${malId}/${ep.episodeNumber}`)
  }

  const syncingDuration = syncTick

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050816] pt-16">
        <div className="flex flex-col lg:flex-row gap-6 max-w-[1500px] mx-auto px-4 py-6">
          <div className="flex-1 min-w-0">
            <div className="skeleton w-full aspect-video rounded-xl" />
            <div className="mt-4 space-y-3">
              <div className="skeleton h-6 w-64 rounded" />
              <div className="skeleton h-4 w-48 rounded" />
            </div>
          </div>
          <div className="w-full lg:w-96 flex-shrink-0">
            <div className="skeleton h-6 w-24 rounded mb-4" />
            <EpisodeSkeleton />
          </div>
        </div>
      </div>
    )
  }

  if (!anime) {
    return (
      <div className="min-h-screen bg-[#050816] pt-16 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 px-4 text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-white text-xl font-bold">Anime not found</h2>
          <p className="text-muted text-sm">This anime doesn't exist or has been removed.</p>
          <Link to="/browse" className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all mt-2">
            Browse Anime
          </Link>
        </div>
      </div>
    )
  }

  const hasRealEpisodes = episodes.some((e) => e.embedUrl)

  return (
    <div className="min-h-screen bg-[#050816]">
      {/* Top bar */}
      <div className="sticky top-16 z-30 bg-[#050816]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          <Link
            to={`/anime/${malId}`}
            className="text-muted hover:text-white text-sm transition-colors inline-flex items-center gap-1.5 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">{anime.title}</span>
            <span className="sm:hidden">Back</span>
          </Link>
          <span className="text-muted/50 text-xs">/</span>
          <span className="text-white text-sm font-medium truncate">Episode {currentEp}</span>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Video Player + Info */}
          <div className="flex-1 min-w-0">
            <VideoPlayer
              embedUrl={embedUrl}
              poster={anime.imageUrl}
              animeTitle={anime.title}
              episodeNumber={currentEp}
              animeId={malId}
              onRetry={retry}
              onChangeSource={() => {
                const ep = episodes.find((e) => e.episodeNumber === currentEp)
                if (ep?.embedUrl) {
                  setEmbedUrl('')
                  setTimeout(() => {
                    setEmbedUrl(PROXY_BASE + encodeURIComponent(ep.embedUrl))
                  }, 100)
                }
              }}
            />

            {/* Error banner */}
            {fetchError && !syncing && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl"
              >
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-red-400 text-sm font-medium mb-1">Unable to load episodes.</p>
                    <p className="text-red-400/70 text-xs leading-relaxed">{fetchError}</p>
                    <p className="text-red-400/50 text-xs mt-2">
                      Possible reasons: Provider unavailable, Anime not found, Network timeout.
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <button
                        onClick={retry}
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium px-4 py-2 rounded-lg transition-colors"
                      >
                        Retry
                      </button>
                      <Link
                        to={`/anime/${malId}`}
                        className="text-red-400/70 hover:text-red-400 text-xs font-medium transition-colors"
                      >
                        Back to Details
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Syncing indicator */}
            {syncing && !fetchError && (
              <div className="mt-4 flex items-center justify-center gap-2 py-3">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-muted text-xs">
                  {syncingDuration > 10 ? 'Still loading...' : 'Loading episodes...'}
                </p>
              </div>
            )}

            {/* Anime Info Section */}
            <div className="mt-6 pb-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-24 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-white/10 hidden sm:block">
                  <img src={anime.imageUrl} alt={anime.title} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-white text-lg sm:text-xl font-bold font-display">{anime.title}</h1>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                    <span className="text-primary text-xs font-bold">{anime.rating || 'N/A'}</span>
                    <span className="text-muted text-xs">
                      {anime.episodes ? `${anime.episodes} Episodes` : 'Unknown Episodes'}
                    </span>
                    {anime.genres?.length > 0 && (
                      <>
                        {anime.genres.slice(0, 4).map((g) => (
                          <span
                            key={typeof g === 'string' ? g : g.mal_id}
                            className="text-[10px] text-link bg-white/5 px-2 py-0.5 rounded-full border border-white/5"
                          >
                            {typeof g === 'string' ? g : g.name}
                          </span>
                        ))}
                      </>
                    )}
                  </div>
                  {anime.synopsis && (
                    <p className="text-muted text-xs leading-relaxed mt-3 line-clamp-2 max-w-2xl">
                      {anime.synopsis}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Episodes Sidebar */}
          <div className="w-full lg:w-96 flex-shrink-0">
            <div className="lg:sticky lg:top-[104px]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white text-base font-bold flex items-center gap-2">
                  {syncing ? 'Loading...' : `Episodes`}
                  {syncing && (
                    <span className="inline-block w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  )}
                  {!syncing && (
                    <span className="text-muted text-xs font-normal">({episodes.length})</span>
                  )}
                </h2>
              </div>

              {episodes.length === 0 ? (
                <div className="text-center py-12">
                  {syncing ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      <p className="text-muted text-sm">Loading episodes...</p>
                      <p className="text-muted/50 text-xs">Preparing video...</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-muted text-sm mb-1">No episodes available</p>
                      <p className="text-muted/50 text-xs mb-4">Could not load episode list.</p>
                      <button
                        onClick={retry}
                        className="bg-primary/20 hover:bg-primary/30 text-primary text-sm font-medium px-5 py-2 rounded-lg transition-all"
                      >
                        Retry
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {!hasRealEpisodes && (
                    <div className="mb-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                          <p className="text-yellow-400 text-xs font-medium">Stream source unavailable</p>
                          <p className="text-yellow-400/60 text-[10px] mt-0.5">
                            Episodes listed may not play. Source may be temporarily down.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1 max-h-[calc(100vh-250px)] overflow-y-auto pr-1 scrollbar-hide">
                    {episodes.map((ep, i) => (
                      <EpisodeCard
                        key={`${ep.id || ep.episodeNumber}-${i}`}
                        episode={ep}
                        animeId={malId}
                        animeTitle={anime.title}
                        isActive={currentEp === ep.episodeNumber}
                        progress={ep.progress || 0}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
