import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAnimeById, getEpisodes, syncEpisodes, getEpisodeEmbed, getTrending, getAnimeState } from '../api/anime'
import { extractErrorMessage, extractErrorCode } from '../api/client'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import VideoPlayer from '../components/VideoPlayer'
import ImageWithFallback from '../components/ImageWithFallback'
import EpisodeCard from '../components/EpisodeCard'

const EPISODES_PER_PAGE = 30

const RECOVERY_MESSAGES = [
  'Searching provider for stream source...',
  'Refreshing anime mapping...',
  'Validating episode IDs...',
  'Trying another server...',
  'Trying another provider...',
  'Recovering stream connection...',
]

function useAnimeData(malId) {
  return useQuery({
    queryKey: ['anime', malId],
    queryFn: ({ signal }) => getAnimeById(malId, signal),
    enabled: !!malId,
    staleTime: 1000 * 60 * 5,
  })
}

function useEpisodesData(malId) {
  return useQuery({
    queryKey: ['episodes', malId],
    queryFn: ({ signal }) => getEpisodes(malId, signal),
    enabled: !!malId,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  })
}

function useEpisodeSync(malId, episodes, isLoading) {
  const queryClient = useQueryClient()
  const syncAttempted = useRef(false)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(null)

  const doSync = useCallback(async (force) => {
    if (syncAttempted.current && !force) return
    syncAttempted.current = true
    setSyncing(true)
    setSyncError(null)
    try {
      const synced = await syncEpisodes(malId)
      if (synced?.length > 0) {
        queryClient.setQueryData(['episodes', malId], synced)
      } else {
        setSyncError('No episodes available on the streaming provider for this title.')
      }
    } catch (err) {
      const msg = extractErrorMessage(err)
      const code = extractErrorCode(err)
      if (code === 'PROVIDER_NOT_FOUND' || code === 'ALL_PROVIDERS_FAILED') {
        setSyncError(msg)
      } else if (code && code.startsWith('PROVIDER_ERROR')) {
        setSyncError('Streaming provider error. Please try again later.')
      } else if (err.data?.detail?.includes('HTTP_400')) {
        setSyncError('Streaming provider reported an issue with this title.')
      } else {
        setSyncError(msg)
      }
    } finally {
      setSyncing(false)
    }
  }, [malId, queryClient])

  useEffect(() => {
    if (episodes?.length === 0 && !isLoading && !syncing && !syncAttempted.current) {
      doSync()
    }
  }, [episodes, isLoading, syncing, doSync])

  const retry = useCallback(() => {
    syncAttempted.current = false
    doSync(true)
  }, [doSync])

  return { syncing, syncError, retry }
}

function formatEpNum(n) {
  return String(n).padStart(3, '0')
}

function ShareButton({ name, color, url, title }) {
  const shareUrls = {
    Facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    Twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
    Reddit: `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
    Telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    WhatsApp: `https://api.whatsapp.com/send?text=${encodeURIComponent(title)}%20${encodeURIComponent(url)}`,
  }

  const handleClick = () => {
    const shareUrl = shareUrls[name]
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=500')
    }
  }

  return (
    <button
      onClick={handleClick}
      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold transition-transform hover:scale-110"
      style={{ backgroundColor: color }}
      title={name}
    >
      {name[0]}
    </button>
  )
}

function CommentsSection() {
  const [comments, setComments] = useState([
    { id: 1, author: 'AnimeFan', avatar: null, text: 'Great episode! Can\'t wait for the next one.', time: '2 hours ago' },
    { id: 2, author: 'OtakuKing', avatar: null, text: 'The animation quality this season is incredible.', time: '5 hours ago' },
    { id: 3, author: 'MangaReader', avatar: null, text: 'This adapts chapter 45-47 from the manga. Really well done!', time: '1 day ago' },
  ])
  const [newComment, setNewComment] = useState('')
  const [posting, setPosting] = useState(false)

  const handlePost = useCallback(() => {
    if (!newComment.trim() || posting) return
    setPosting(true)
    setTimeout(() => {
      setComments((prev) => [
        { id: Date.now(), author: 'You', avatar: null, text: newComment.trim(), time: 'Just now' },
        ...prev,
      ])
      setNewComment('')
      setPosting(false)
    }, 500)
  }, [newComment, posting])

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
      <h3 className="text-white text-base font-bold mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Comments ({comments.length})
      </h3>
      <div className="flex gap-3 mb-6">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-md">
          U
        </div>
        <div className="flex-1">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-muted outline-none focus:border-primary/50 transition resize-none"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handlePost}
              disabled={!newComment.trim() || posting}
              className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {posting ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Posting...
                </span>
              ) : 'Post'}
            </button>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {comment.author[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-white text-xs font-medium">{comment.author}</span>
                <span className="text-muted/50 text-[10px]">{comment.time}</span>
              </div>
              <p className="text-muted text-xs leading-relaxed">{comment.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InfoBar({ anime, episodesCount, currentEp, onBookmark, onReport, malId }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? window.location.href : ''
  const title = anime?.title || ''

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [url])

  const shareButtons = [
    { name: 'Facebook', color: '#1877F2' },
    { name: 'Twitter', color: '#1DA1F2' },
    { name: 'Reddit', color: '#FF4500' },
    { name: 'Telegram', color: '#0088CC' },
    { name: 'WhatsApp', color: '#25D366' },
  ]

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3">
        <span className="text-xs text-muted font-medium">
          <span className="text-white">{episodesCount > 0 ? episodesCount : '?'}</span> Episodes
        </span>
        <div className="h-3 w-px bg-white/10" />
        <span className="text-xs text-muted font-medium">
          Watching <span className="text-primary">Episode {currentEp}</span>
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {shareButtons.map(({ name, color }) => (
            <ShareButton key={name} name={name} color={color} url={url} title={`${title} - Episode ${currentEp}`} />
          ))}
          <button
            onClick={handleCopyLink}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all hover:scale-110"
            title={copied ? 'Copied!' : 'Copy Link'}
          >
            {copied ? (
              <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            )}
          </button>
          <button
            onClick={onBookmark}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
            title="Add Bookmark"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Bookmark
          </button>
          <button
            onClick={onReport}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/5"
            title="Report broken stream"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Report
          </button>
        </div>
      </div>
    </>
  )
}

function AnimeInfo({ anime, episodes }) {
  const genres = useMemo(() => {
    if (!anime?.genres) return []
    return anime.genres.map((g) => (typeof g === 'string' ? g : g.name))
  }, [anime?.genres])

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
      <div className="flex gap-5">
        <div className="w-24 h-36 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-white/10 hidden sm:block">
          <ImageWithFallback src={anime?.imageUrl} alt={anime?.title} className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-white text-xl font-bold font-display truncate">{anime?.title}</h1>
              {anime?.title_japanese && (
                <p className="text-muted/50 text-xs mt-0.5 truncate">{anime.title_japanese}</p>
              )}
            </div>
            {anime?.score && (
              <div className="flex items-center gap-1 flex-shrink-0 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-2.5 py-1">
                <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-yellow-400 text-xs font-bold">{anime.score}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {anime?.type && (
              <span className="text-[10px] bg-primary/15 text-primary font-bold px-2 py-0.5 rounded">{anime.type}</span>
            )}
            {anime?.status && (
              <span className="text-[10px] bg-white/10 text-muted px-2 py-0.5 rounded">{anime.status}</span>
            )}
            {anime?.rating && (
              <span className="text-[10px] bg-white/10 text-muted px-2 py-0.5 rounded">{anime.rating}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mt-4 text-xs">
            {[
              ['Type', anime?.type || 'TV'],
              ['Episodes', String(episodes.length || anime?.episodes || '?')],
              ['Status', anime?.status || 'Unknown'],
              ['Duration', anime?.duration || 'Unknown'],
              ['Aired', anime?.aired || 'Unknown'],
              ['Score', anime?.score || 'N/A'],
              ['Genres', genres.slice(0, 3).join(', ') || 'N/A'],
              ['Studios', anime?.studios?.map(s => typeof s === 'string' ? s : s.name).join(', ') || 'N/A'],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <span className="text-muted whitespace-nowrap">{label}:</span>
                <span className="text-white truncate">{value}</span>
              </div>
            ))}
          </div>
          {genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {genres.map((genre) => (
                <Link
                  key={genre}
                  to={`/browse?genres=${genre.toLowerCase()}`}
                  className="text-[10px] text-link bg-white/5 hover:bg-primary/20 hover:text-primary border border-white/10 hover:border-primary/30 px-2.5 py-0.5 rounded-full transition-all duration-300"
                >
                  {genre}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EpisodeSidebar({ episodes, currentEp, onSelect, syncing, error, onRetry, malId }) {
  const [epRangeIdx, setEpRangeIdx] = useState(0)
  const [epSearch, setEpSearch] = useState('')
  const sidebarRef = useRef(null)

  const epRanges = useMemo(() => {
    if (episodes.length === 0) return []
    const ranges = []
    let i = 1
    while (i <= episodes.length) {
      const end = Math.min(i + EPISODES_PER_PAGE - 1, episodes.length)
      ranges.push({ start: i, end, label: `${formatEpNum(i)}–${formatEpNum(end)}` })
      i = end + 1
    }
    return ranges
  }, [episodes])

  const filteredEpisodes = useMemo(() => {
    const range_ = epRanges[epRangeIdx]
    if (!range_) return episodes
    const inRange = episodes.filter((e) => e.episodeNumber >= range_.start && e.episodeNumber <= range_.end)
    if (!epSearch) return inRange
    return inRange.filter((e) => String(e.episodeNumber).includes(epSearch))
  }, [episodes, epRangeIdx, epRanges, epSearch])

  useEffect(() => {
    if (sidebarRef.current) {
      const active = sidebarRef.current.querySelector('[data-active="true"]')
      if (active) {
        active.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [currentEp])

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white text-sm font-bold flex items-center gap-2">
          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Episodes
        </h2>
        {!syncing && episodes.length > 0 && (
          <span className="text-muted text-xs bg-white/5 px-2 py-0.5 rounded">{episodes.length}</span>
        )}
      </div>

      {syncing && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted text-xs">Loading episodes...</p>
        </div>
      )}

      {!syncing && error && (
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-muted text-xs mb-3">{error}</p>
          <button onClick={onRetry} className="bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium px-4 py-2 rounded-lg transition-all">Retry</button>
        </div>
      )}

      {!syncing && !error && episodes.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted text-sm">No episodes available</p>
          <button onClick={onRetry} className="mt-3 bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium px-4 py-2 rounded-lg transition-all">Retry</button>
        </div>
      )}

      {!syncing && !error && episodes.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <select
              value={epRangeIdx}
              onChange={(e) => {
                setEpRangeIdx(Number(e.target.value))
                setEpSearch('')
              }}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-primary/50 transition flex-1 cursor-pointer"
            >
              {epRanges.map((r, i) => (
                <option key={i} value={i} className="bg-body">{r.label}</option>
              ))}
            </select>
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Find number"
                value={epSearch}
                onChange={(e) => setEpSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-3 pr-8 py-1.5 text-xs text-white placeholder-muted outline-none focus:border-primary/50 transition"
              />
              {epSearch && (
                <button
                  onClick={() => setEpSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {!epSearch && (
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </div>
          </div>

          <div ref={sidebarRef} className="space-y-1 max-h-[400px] overflow-y-auto pr-1 scrollbar-hide">
            {filteredEpisodes.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted text-xs">No episodes match your search</p>
              </div>
            ) : (
              filteredEpisodes.map((ep) => (
                <div
                  key={ep.episodeNumber}
                  data-active={currentEp === ep.episodeNumber}
                >
                  <EpisodeCard
                    episode={ep}
                    animeId={malId}
                    isActive={currentEp === ep.episodeNumber}
                    progress={0}
                  />
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

function RecommendedSection({ malId }) {
  const [recommended, setRecommended] = useState([])

  useEffect(() => {
    const controller = new AbortController()
    getTrending(0, 30, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return
        const list = (res.data || []).filter((a) => String(a.malId || a.id) !== String(malId))
        setRecommended(list.slice(0, 6))
      })
      .catch(() => {})
    return () => controller.abort()
  }, [malId])

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
      <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
        Recommendations
      </h3>
      {recommended.length === 0 ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {recommended.map((rec) => (
            <Link
              key={rec.malId || rec.id}
              to={`/watch/${rec.malId || rec.id}/1`}
              className="flex gap-3 group"
            >
              <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-surface/50 ring-1 ring-white/5">
                <ImageWithFallback src={rec.imageUrl} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 flex-1 py-0.5">
                <p className="text-xs text-white font-medium truncate group-hover:text-primary transition-colors">{rec.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {rec.type && <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded">{rec.type}</span>}
                  {rec.score && (
                    <span className="text-[10px] text-yellow-400 flex items-center gap-0.5">
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {rec.score}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted mt-0.5">{rec.episodes || '?'} Episodes</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-body pt-16">
      <div className="max-w-[1500px] mx-auto px-4 py-6">
        <div className="flex gap-6">
          <div className="flex-[7] min-w-0 space-y-4">
            <div className="skeleton w-full aspect-video rounded-xl" />
            <div className="skeleton h-10 w-full rounded-xl" />
            <div className="skeleton h-40 w-full rounded-xl" />
            <div className="skeleton h-60 w-full rounded-xl" />
          </div>
          <div className="flex-[3] hidden lg:block space-y-4">
            <div className="skeleton h-96 rounded-xl" />
            <div className="skeleton h-80 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

const PROXY_BASE = '/api/stream/proxy'

function wrapProxy(url, referer) {
  if (!url) return ''
  return `${PROXY_BASE}?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer || 'https://anineko.to/')}`
}

export default function WatchPage() {
  const { malId, episodeNumber } = useParams()
  const navigate = useNavigate()
  const mountedRef = useRef(true)

  const [currentEp, setCurrentEp] = useState(Number(episodeNumber) || 1)
  const [embedUrl, setEmbedUrl] = useState('')
  const [embedType, setEmbedType] = useState('iframe')
  const [embedLoading, setEmbedLoading] = useState(false)
  const [embedError, setEmbedError] = useState(null)
  const [servers, setServers] = useState([])
  const [loadingStage, setLoadingStage] = useState(0)
  const [recoveryStage, setRecoveryStage] = useState(0)
  const [recoveryAttempted, setRecoveryAttempted] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [reported, setReported] = useState(false)
  const [checkingProvider, setCheckingProvider] = useState(false)
  const [providerStatus, setProviderStatus] = useState(null)

  const animeQuery = useAnimeData(malId)
  const episodesQuery = useEpisodesData(malId)
  const { syncing, syncError, retry: retrySync } = useEpisodeSync(
    malId,
    episodesQuery.data,
    episodesQuery.isLoading
  )

  const anime = animeQuery.data
  const episodes = episodesQuery.data ?? []
  const loading = animeQuery.isLoading
  const error = animeQuery.error ? extractErrorMessage(animeQuery.error) : syncError

  const currentEpisode = episodes.find((e) => e.episodeNumber === currentEp)

  const title = anime ? `${anime.title} - Episode ${currentEp}` : 'Loading...'
  useDocumentTitle(title)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (anime?.status) {
      const s = anime.status.toUpperCase().replace(/\s+/g, '_')
      if (s === 'COMING_SOON' || s === 'NOT_RELEASED' || s === 'NOT_YET_RELEASED' || s === 'NOT_YET_AIRED') {
        navigate(`/coming-soon/${malId}`, { replace: true })
      }
    }
  }, [anime, malId, navigate])

  useEffect(() => {
    if (!malId) return
    getAnimeState(malId).then(state => {
      if (state?.comingSoon) {
        navigate(`/coming-soon/${malId}`, { replace: true })
      }
    }).catch(() => {})
  }, [malId, navigate])

  useEffect(() => {
    setCurrentEp(Number(episodeNumber) || 1)
    setEmbedLoading(true)
  }, [episodeNumber, malId])

  useEffect(() => {
    if (!embedLoading) { setLoadingStage(0); return }
    const timers = [
      setTimeout(() => setLoadingStage(1), 5000),
      setTimeout(() => setLoadingStage(2), 12000),
      setTimeout(() => setLoadingStage(3), 20000),
      setTimeout(() => setLoadingStage(4), 30000),
      setTimeout(() => setLoadingStage(5), 45000),
    ]
    return () => timers.forEach(clearTimeout)
  }, [embedLoading])

  useEffect(() => {
    if (embedLoading && recoveryStage < 5) {
      const interval = setInterval(() => {
        setRecoveryStage((s) => Math.min(s + 1, 5))
      }, 8000)
      return () => clearInterval(interval)
    }
  }, [embedLoading, recoveryStage])

  const loadEmbed = useCallback(async () => {
    if (episodes.length === 0) {
      if (syncing) {
        setEmbedUrl('')
        setEmbedError(null)
      } else {
        setEmbedError('No episodes available yet. Try syncing episodes from the details page.')
      }
      return
    }
    const ep = episodes.find((e) => e.episodeNumber === currentEp) || episodes[0]
    if (!ep?.embedUrl) { setEmbedUrl(''); setEmbedError('Episode URL not available.'); return }
    setEmbedLoading(true)
    setEmbedError(null)
    setRecoveryStage(0)
    setRecoveryAttempted(false)
    setProviderStatus(null)
    try {
      const payload = await getEpisodeEmbed(malId, ep.embedUrl)
      if (!mountedRef.current) return
      const referer = payload.referer || 'https://anineko.to/'
      if (payload?.embedUrl) {
        setEmbedUrl(wrapProxy(payload.embedUrl, referer))
        setEmbedType(payload.type || 'iframe')
        setServers((payload.servers || []).map(s => ({
          ...s,
          url: wrapProxy(s.url, referer)
        })))
      } else {
        setEmbedError('Could not retrieve stream URL.')
        setServers([])
      }
    } catch (err) {
      if (!mountedRef.current) return
      const errorMsg = extractErrorMessage(err)
      setEmbedError(errorMsg)
      setRecoveryStage(3)
      setRecoveryAttempted(true)
    } finally {
      if (mountedRef.current) setEmbedLoading(false)
    }
  }, [episodes, currentEp, malId, syncing])

  useEffect(() => {
    loadEmbed()
  }, [loadEmbed])

  const onNextEpisode = useCallback(() => {
    const next = episodes.find((e) => e.episodeNumber === currentEp + 1)
    if (next) {
      setCurrentEp(next.episodeNumber)
      window.history.replaceState(null, '', `/watch/${malId}/${next.episodeNumber}`)
      setEmbedLoading(true)
    }
  }, [episodes, currentEp, malId])

  const handleEpisodeSelect = useCallback((ep) => {
    setCurrentEp(ep.episodeNumber)
    window.history.replaceState(null, '', `/watch/${malId}/${ep.episodeNumber}`)
    setEmbedLoading(true)
  }, [malId])

  const handleBookmark = useCallback(() => {
    setBookmarked((prev) => !prev)
  }, [])

  const handleReport = useCallback(() => {
    setReported(true)
    setTimeout(() => setReported(false), 3000)
  }, [])

  const handleRetryEmbed = useCallback(() => {
    loadEmbed()
  }, [loadEmbed])

  const handleCheckProvider = useCallback(async () => {
    setCheckingProvider(true)
    setProviderStatus(null)
    try {
      const res = await fetch('/api/stream/health')
      const data = await res.json()
      setProviderStatus(data)
    } catch {
      setProviderStatus({ error: 'Could not reach provider health endpoint.' })
    } finally {
      setCheckingProvider(false)
    }
  }, [])

  useEffect(() => {
    const nextEp = episodes.find(e => e.episodeNumber === currentEp + 1)
    if (nextEp?.embedUrl) {
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.href = wrapProxy(nextEp.embedUrl, 'https://anineko.to/')
      document.head.appendChild(link)
    }
  }, [currentEp, episodes])

  const player = useMemo(() => {
    if (embedLoading && !embedUrl) {
      return (
        <div className="w-full aspect-video bg-[#050816] rounded-xl overflow-hidden flex items-center justify-center shadow-2xl shadow-primary/5">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-muted text-xs">{RECOVERY_MESSAGES[Math.min(loadingStage, RECOVERY_MESSAGES.length - 1)]}</p>
          </div>
        </div>
      )
    }

    if (embedError && !embedUrl) {
      return (
        <div className="w-full aspect-video bg-[#050816] rounded-xl overflow-hidden flex items-center justify-center shadow-2xl shadow-primary/5">
          <div className="flex flex-col items-center gap-4 px-6 text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-white text-sm font-medium mb-1">Stream source unavailable</p>
              <p className="text-muted text-xs">{embedError}</p>
              {recoveryAttempted && (
                <p className="text-yellow-400/70 text-xs mt-2">Automatic recovery was attempted.</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleRetryEmbed} className="bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-lg text-sm font-medium transition-all">Retry</button>
              <Link to={`/anime/${malId}`} className="text-muted hover:text-white text-sm font-medium transition-colors">Back to Details</Link>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCheckProvider}
                disabled={checkingProvider}
                className="text-xs text-muted hover:text-primary transition-colors flex items-center gap-1"
              >
                {checkingProvider ? (
                  <span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                )}
                {checkingProvider ? 'Checking...' : 'Check provider status'}
              </button>
              <button onClick={handleReport} className="text-muted hover:text-red-400 text-xs transition-colors flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {reported ? 'Reported!' : 'Report broken stream'}
              </button>
            </div>
            {providerStatus && (
              <div className="w-full bg-white/[0.02] border border-white/5 rounded-lg p-3 text-left">
                <p className="text-[10px] text-muted font-semibold uppercase tracking-wider mb-1">Provider Status</p>
                {providerStatus.error ? (
                  <p className="text-xs text-red-400">{providerStatus.error}</p>
                ) : (
                  <div className="space-y-0.5">
                    {Object.entries(providerStatus).map(([key, value]) => (
                      <p key={key} className="text-xs text-muted">
                        <span className="text-white/50">{key}: </span>
                        <span className={value === 'ok' || value === true ? 'text-green-400' : 'text-yellow-400'}>
                          {String(value)}
                        </span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

    return (
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
        onEnded={onNextEpisode}
        autoNext={true}
        autoPlay={true}
      />
    )
  }, [embedLoading, embedUrl, embedError, loadingStage, recoveryStage, recoveryAttempted, anime, currentEp, malId, servers, embedType, onNextEpisode, handleRetryEmbed, handleCheckProvider, checkingProvider, providerStatus, handleReport, reported])

  useEffect(() => {
    if (anime && currentEp > 1) {
      try {
        const continueData = JSON.parse(localStorage.getItem('animewatch_continue') || '{}')
        continueData[malId] = {
          animeId: malId,
          animeTitle: anime.title,
          animeImage: anime.imageUrl,
          episode: currentEp,
          timestamp: Date.now(),
        }
        localStorage.setItem('animewatch_continue', JSON.stringify(continueData))
      } catch {}
    }
  }, [anime, malId, currentEp])

  if (loading) {
    return <LoadingSkeleton />
  }

  if (!anime && !loading) {
    return (
      <div className="min-h-screen bg-body pt-16 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 px-4 text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-white text-xl font-bold">Anime not found</h2>
          <p className="text-muted text-sm">This anime doesn't exist or has been removed.</p>
          <Link to="/browse" className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all mt-2">Browse Anime</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-body">
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
        </div>
      </div>

      <div className="max-w-[1500px] mx-auto px-4 py-4">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-[7] min-w-0 space-y-4">
            <div className="relative">
              {player}
            </div>

            <InfoBar
              anime={anime}
              episodesCount={episodes.length}
              currentEp={currentEp}
              onBookmark={handleBookmark}
              onReport={handleReport}
              malId={malId}
            />

            {bookmarked && (
              <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 flex items-center gap-3">
                <svg className="w-4 h-4 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <p className="text-xs text-muted">
                  Bookmarked! <span className="text-primary font-medium">Episode {currentEp}</span> added to your bookmarks.
                </p>
              </div>
            )}

            {reported && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
                <svg className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-muted">
                  Report submitted. Thank you for helping us improve the streaming experience.
                </p>
              </div>
            )}

            {!syncing && !error && episodes.length > 0 && (
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-white text-base font-bold">Now Playing</h2>
                  <Link
                    to={`/anime/${malId}`}
                    className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                  >
                    View Details
                  </Link>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <span className="text-primary text-2xl font-bold">{formatEpNum(currentEp)}</span>
                    </div>
                    <p className="text-[10px] text-muted mt-1">Episode</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">
                      {currentEpisode?.title || `Episode ${currentEp}`}
                    </p>
                    {currentEpisode?.duration && (
                      <p className="text-muted text-xs mt-0.5">{currentEpisode.duration}</p>
                    )}
                    {anime?.title && (
                      <p className="text-muted text-xs mt-0.5 truncate">{anime.title}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {error && !syncing && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-red-400 text-sm font-medium mb-1">Unable to load episodes.</p>
                    <p className="text-red-400/70 text-xs leading-relaxed">{error}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <button onClick={retrySync} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium px-4 py-2 rounded-lg transition-colors">Retry</button>
                      <Link to={`/anime/${malId}`} className="text-red-400/70 hover:text-red-400 text-xs font-medium transition-colors">Back to Details</Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {syncing && !error && (
              <div className="flex items-center justify-center gap-2 py-3">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-muted text-xs">Loading episodes...</p>
              </div>
            )}

            {anime && (
              <AnimeInfo anime={anime} episodes={episodes} />
            )}

            <CommentsSection />

            <div className="lg:hidden space-y-4">
              <EpisodeSidebar
                episodes={episodes}
                currentEp={currentEp}
                onSelect={handleEpisodeSelect}
                syncing={syncing}
                error={syncError}
                onRetry={retrySync}
                malId={malId}
              />
              <RecommendedSection malId={malId} />
            </div>
          </div>

          <div className="flex-[3] w-full lg:max-w-sm space-y-6 hidden lg:block">
            <EpisodeSidebar
              episodes={episodes}
              currentEp={currentEp}
              onSelect={handleEpisodeSelect}
              syncing={syncing}
              error={syncError}
              onRetry={retrySync}
              malId={malId}
            />
            <RecommendedSection malId={malId} />
          </div>
        </div>
      </div>
    </div>
  )
}
