import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getAnimeById, getEpisodes, syncEpisodes } from '../api/anime'
import VideoPlayer from '../components/VideoPlayer'
import EpisodeCard from '../components/EpisodeCard'
import { EpisodeSkeleton } from '../components/Skeleton'
import ErrorState from '../components/ErrorState'

const PROXY_BASE = '/api/anime/proxy/animepahe?url='

export default function WatchPage() {
  const { malId, episodeNumber } = useParams()
  const [anime, setAnime] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [currentEp, setCurrentEp] = useState(Number(episodeNumber) || 1)
  const [embedUrl, setEmbedUrl] = useState('')
  const [fetching, setFetching] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [showSidebar, setShowSidebar] = useState(true)

  const deduplicateEpisodes = (eps) => {
    const seen = new Set()
    const unique = []
    for (const ep of eps) {
      const key = ep.episodeNumber
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(ep)
      }
    }
    return unique.sort((a, b) => a.episodeNumber - b.episodeNumber)
  }

  useEffect(() => {
    setFetching(true)
    setFetchError('')
    Promise.all([
      getAnimeById(malId).catch(() => null),
      getEpisodes(malId).catch(() => []),
    ]).then(([animeData, eps]) => {
      if (animeData) setAnime(animeData)
      const uniqueEps = deduplicateEpisodes(eps)
      if (uniqueEps.length > 0) {
        setEpisodes(uniqueEps)
      } else if (animeData) {
        setSyncing(true)
        syncEpisodes(malId).then(synced => {
          const unique = deduplicateEpisodes(synced)
          setEpisodes(unique)
          if (!unique.length) setFetchError('Could not load episodes')
        }).catch(() => {
          setFetchError('Could not load episodes')
        }).finally(() => setSyncing(false))
      }
    }).finally(() => setFetching(false))
  }, [malId])

  useEffect(() => {
    setCurrentEp(Number(episodeNumber) || 1)
  }, [episodeNumber])

  useEffect(() => {
    if (episodes.length === 0) return
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

  const handleRetry = useCallback(() => {
    setFetchError('')
    setSyncing(true)
    syncEpisodes(malId).then(synced => {
      const unique = deduplicateEpisodes(synced)
      setEpisodes(unique)
      if (!unique.length) setFetchError('Could not load episodes')
    }).catch(() => {
      setFetchError('Could not load episodes')
    }).finally(() => setSyncing(false))
  }, [malId])

  const handleChangeSource = useCallback(() => {
    const ep = episodes.find((e) => e.episodeNumber === currentEp)
    if (ep?.embedUrl) {
      setEmbedUrl('')
      setTimeout(() => {
        setEmbedUrl(PROXY_BASE + encodeURIComponent(ep.embedUrl))
      }, 100)
    }
  }, [episodes, currentEp])

  if (fetching || syncing) {
    return (
      <div className="min-h-screen bg-[#070B14] pt-16">
        <div className="flex flex-col lg:flex-row gap-6 max-w-[1440px] mx-auto px-4 py-6">
          <div className="flex-1">
            <div className="skeleton w-full aspect-video rounded-xl" />
            <div className="mt-4 space-y-3">
              <div className="skeleton h-6 w-64 rounded" />
              <div className="skeleton h-4 w-48 rounded" />
            </div>
          </div>
          <div className="w-full lg:w-80 flex-shrink-0">
            <div className="skeleton h-6 w-24 rounded mb-4" />
            <EpisodeSkeleton />
          </div>
        </div>
      </div>
    )
  }

  if (!anime) {
    return (
      <div className="min-h-screen bg-[#070B14] pt-16">
        <ErrorState title="Anime not found" message="This anime doesn't exist or has been removed." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#070B14]">
      <div className="flex flex-col lg:flex-row max-w-[1440px] mx-auto">
        <div className="flex-1 min-w-0 p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <Link to={`/anime/${malId}`} className="text-muted hover:text-white text-sm transition-colors inline-flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {anime.title}
            </Link>
            <span className="text-muted text-xs">EP {currentEp}</span>
          </div>

          <VideoPlayer
            embedUrl={embedUrl}
            onRetry={handleRetry}
            onChangeSource={handleChangeSource}
          />

          <div className="mt-4 space-y-1">
            <h1 className="text-white text-lg font-bold">{anime.title}</h1>
            <p className="text-muted text-sm">Episode {currentEp}</p>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <span className="text-primary text-xs font-bold">{anime.rating || 'N/A'}</span>
            <span className="text-muted text-xs">
              {anime.episodes ? `${anime.episodes} Episodes` : 'Unknown Episodes'}
            </span>
            {anime.genres?.length > 0 && (
              <div className="flex items-center gap-2 ml-2">
                {anime.genres.slice(0, 3).map((g) => (
                  <span key={typeof g === 'string' ? g : g.mal_id} className="text-[10px] text-link bg-white/5 px-2 py-0.5 rounded-full">
                    {typeof g === 'string' ? g : g.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 border-l border-white/5 lg:max-h-screen lg:overflow-y-auto">
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-base font-bold">Episodes</h2>
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="lg:hidden text-muted hover:text-white text-xs"
              >
                {showSidebar ? 'Hide' : 'Show'}
              </button>
            </div>

            {episodes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted text-sm mb-2">No episodes available</p>
                <button
                  onClick={handleRetry}
                  className="text-primary text-sm font-medium hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {episodes.map((ep) => (
                  <EpisodeCard
                    key={ep.id || ep.episodeNumber}
                    episode={ep}
                    animeId={malId}
                    animeTitle={anime.title}
                    isActive={currentEp === ep.episodeNumber}
                    progress={ep.progress || 0}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
