import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getAnimeById, getEpisodes, syncEpisodes, getEpisodeEmbed, getTrending, createStreamToken } from '../api/anime'
import { extractErrorMessage } from '../api/client'
import VideoPlayer from '../components/VideoPlayer'

const EPISODES_PER_PAGE = 30

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
          if (!seen.has(key)) { seen.add(key); unique.push(ep) }
        }
        unique.sort((a, b) => a.episodeNumber - b.episodeNumber)
        if (unique.length > 0) {
          setEpisodes(unique)
          setSyncing(false)
          if (syncTimerRef.current) clearInterval(syncTimerRef.current)
          return
        }
        lastError = 'No episodes returned'
      } catch (err) { lastError = err }
      if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 2000))
    }
    if (!mountedRef.current) return
    setError(typeof lastError === 'string' ? lastError : extractErrorMessage(lastError))
    setSyncing(false)
    if (syncTimerRef.current) clearInterval(syncTimerRef.current)
  }, [malId])

  const fetchData = useCallback(async (signal) => {
    if (!mountedRef.current) return
    setLoading(true); setError(null); setSyncTick(0)
    const [animeData, eps] = await Promise.all([
      getAnimeById(malId, signal).catch(() => null),
      getEpisodes(malId, signal).catch(() => []),
    ])
    if (!mountedRef.current || signal?.aborted) return
    if (animeData) setAnime(animeData)
    else { setError('Anime not found'); setLoading(false); return }
    const seen = new Set()
    const unique = []
    for (const ep of eps) {
      const key = ep.episodeNumber
      if (!seen.has(key)) { seen.add(key); unique.push(ep) }
    }
    unique.sort((a, b) => a.episodeNumber - b.episodeNumber)
    if (unique.length > 0) { setEpisodes(unique); setLoading(false); return }
    setSyncing(true); setLoading(false)
    syncTimerRef.current = setInterval(() => setSyncTick((t) => t + 1), 1000)
    await doSync()
  }, [malId, doSync])

  useEffect(() => {
    const controller = new AbortController()
    fetchData(controller.signal)
    return () => controller.abort()
  }, [fetchData])
  return { anime, episodes, syncing, error, retry: fetchData, loading, syncTick }
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

function formatEpNum(n) {
  return String(n).padStart(3, '0')
}

export default function WatchPage() {
  const { malId, episodeNumber } = useParams()
  const { anime, episodes, syncing, error: fetchError, retry, loading, syncTick } = useSyncedEpisodes(malId)

  const [currentEp, setCurrentEp] = useState(Number(episodeNumber) || 1)
  const [embedUrl, setEmbedUrl] = useState('')
  const [epRangeIdx, setEpRangeIdx] = useState(0)
  const [epSearch, setEpSearch] = useState('')
  const [autoPlay, setAutoPlay] = useState(true)
  const [autoSkip, setAutoSkip] = useState(true)
  const [autoNext, setAutoNext] = useState(true)
  const [lightOff, setLightOff] = useState(false)
  const [showCountdown, setShowCountdown] = useState(true)
  const [shareCount, setShareCount] = useState(0)
  const [recommended, setRecommended] = useState([])

  useEffect(() => {
    const controller = new AbortController()
    getTrending(0, 30, controller.signal).then((res) => {
      if (controller.signal.aborted) return
      const list = (res.data || []).filter((a) => String(a.malId || a.id) !== String(malId))
      setRecommended(list.slice(0, 20))
    }).catch(() => {})
    return () => controller.abort()
  }, [malId])

  useEffect(() => {
    setCurrentEp(Number(episodeNumber) || 1)
  }, [episodeNumber])

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function loadEmbed() {
      if (episodes.length === 0) { setEmbedUrl(''); return }
      const ep = episodes.find((e) => e.episodeNumber === currentEp) || episodes[0]
      if (!ep?.embedUrl) { setEmbedUrl(''); return }
      if (ep.embedUrl.startsWith('https://anineko.to/')) {
        setEmbedUrl('')
        const rawUrl = await getEpisodeEmbed(malId, ep.embedUrl, signal)
        if (signal.aborted || !rawUrl) return
        const token = await createStreamToken(rawUrl, signal)
        if (!signal.aborted && token) setEmbedUrl(`/api/stream/proxy/${token}`)
      } else {
        setEmbedUrl('')
      }
    }
    loadEmbed()
    return () => controller.abort()
  }, [episodes, currentEp, malId])

  const handleEpisodeSelect = (ep) => {
    setCurrentEp(ep.episodeNumber)
    window.history.replaceState(null, '', `/watch/${malId}/${ep.episodeNumber}`)
  }

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
    setShareCount(Math.floor(Math.random() * 50) + 10)
  }, [])

  const currentEpisode = episodes.find((e) => e.episodeNumber === currentEp)

  if (loading) {
    return (
      <div className="min-h-screen bg-body pt-16">
        <div className="max-w-[1500px] mx-auto px-4 py-6">
          <div className="flex gap-6">
            <div className="flex-[7] min-w-0">
              <div className="skeleton w-full aspect-video rounded-xl" />
            </div>
            <div className="flex-[3] hidden lg:block">
              <div className="skeleton h-96 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!anime) {
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
      {/* Top bar */}
      <div className="sticky top-16 z-30 bg-body/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1500px] mx-auto px-4 py-3 flex items-center gap-3">
          <Link to={`/anime/${malId}`} className="text-muted hover:text-white text-sm transition-colors inline-flex items-center gap-1.5 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            <span className="hidden sm:inline">{anime.title}</span>
            <span className="sm:hidden">Back</span>
          </Link>
          <span className="text-muted/50 text-xs">/</span>
          <span className="text-white text-sm font-medium truncate">Episode {currentEp}</span>
        </div>
      </div>

      <div className="max-w-[1500px] mx-auto px-4 py-4">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ===== LEFT COLUMN (~70%) ===== */}
          <div className="flex-[7] min-w-0 space-y-4">
            {/* Video Player */}
            <VideoPlayer
              embedUrl={embedUrl}
              poster={anime.imageUrl}
              animeTitle={anime.title}
              episodeNumber={currentEp}
              animeId={malId}
              onRetry={retry}
              onChangeSource={async () => {
                const ep = episodes.find((e) => e.episodeNumber === currentEp)
                if (ep?.embedUrl) {
                  setEmbedUrl('')
                  if (ep.embedUrl.startsWith('https://anineko.to/')) {
                    const rawUrl = await getEpisodeEmbed(malId, ep.embedUrl)
                    if (rawUrl) {
                      const token = await createStreamToken(rawUrl)
                      if (token) setEmbedUrl(`/api/stream/proxy/${token}`)
                    }
                  }
                }
              }}
            />

            {/* Player Controls */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3">
              {[
                { label: 'Auto Play', state: autoPlay, set: setAutoPlay },
                { label: 'Auto Skip', state: autoSkip, set: setAutoSkip },
                { label: 'Auto Next', state: autoNext, set: setAutoNext },
                { label: 'Light', state: lightOff, set: setLightOff },
              ].map(({ label, state, set }) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={state} onChange={() => set(!state)} className="w-3.5 h-3.5 accent-primary rounded" />
                  <span className="text-xs text-muted font-medium">{label}</span>
                </label>
              ))}
              <button className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors ml-auto">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                Add Bookmark
              </button>
            </div>

            {/* Notice Banner */}
            <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 flex items-center gap-3">
              <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-xs text-muted">
                Bookmark <span className="text-primary font-medium">anime-watch.local</span> to stay updated on new episodes.
              </p>
            </div>

            {/* Countdown Banner */}
            {showCountdown && (
              <div className="bg-white/[0.04] border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3">
                <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-xs text-muted flex-1">Next episode arrives in <span className="text-white font-medium">~7 days</span></p>
                <button onClick={() => setShowCountdown(false)} className="text-muted hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}

            {/* Status Line */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-white font-medium">You are watching Episode {currentEp}</span>
              {syncing && (
                <span className="text-xs text-muted flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  Loading episodes...
                </span>
              )}
              {embedUrl && !syncing && (
                <span className="text-xs text-muted/50">buffering...</span>
              )}
            </div>

            {/* Error banner */}
            {fetchError && !syncing && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  <div className="flex-1">
                    <p className="text-red-400 text-sm font-medium mb-1">Unable to load episodes.</p>
                    <p className="text-red-400/70 text-xs leading-relaxed">{fetchError}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <button onClick={retry} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium px-4 py-2 rounded-lg transition-colors">Retry</button>
                      <Link to={`/anime/${malId}`} className="text-red-400/70 hover:text-red-400 text-xs font-medium transition-colors">Back to Details</Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Syncing indicator */}
            {syncing && !fetchError && (
              <div className="flex items-center justify-center gap-2 py-3">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-muted text-xs">{syncTick > 10 ? 'Still looking for episodes...' : 'Loading episodes...'}</p>
              </div>
            )}

            {/* ===== SHARE BAR ===== */}
            {!syncing && episodes.length > 0 && (
              <div className="bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap">
                <span className="text-xs text-muted font-medium whitespace-nowrap">
                  <span className="text-white">{shareCount}</span> Shares
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { name: 'Facebook', color: '#1877F2' },
                    { name: 'X', color: '#1DA1F2' },
                    { name: 'Messenger', color: '#00B2FF' },
                    { name: 'Reddit', color: '#FF4500' },
                    { name: 'WhatsApp', color: '#25D366' },
                    { name: 'Telegram', color: '#0088CC' },
                  ].map(({ name, color }) => (
                    <button
                      key={name}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold transition-transform hover:scale-110"
                      style={{ backgroundColor: color }}
                      title={name}
                    >
                      {name[0]}
                    </button>
                  ))}
                  <button className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors" title="Share">
                    <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  </button>
                </div>
              </div>
            )}

            {/* ===== EPISODE LIST ===== */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white text-sm font-bold">Episodes</h2>
                {!syncing && <span className="text-muted text-xs">({episodes.length})</span>}
              </div>

              {syncing && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <p className="text-muted text-xs">Loading episodes...</p>
                </div>
              )}

              {!syncing && episodes.length === 0 && !fetchError && (
                <div className="text-center py-8">
                  <p className="text-muted text-sm">No episodes available</p>
                  <button onClick={retry} className="mt-3 bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium px-4 py-2 rounded-lg transition-all">Retry</button>
                </div>
              )}

              {!syncing && episodes.length > 0 && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <select
                      value={epRangeIdx}
                      onChange={(e) => setEpRangeIdx(Number(e.target.value))}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-primary/50 transition flex-1"
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
                      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5 max-h-[400px] overflow-y-auto pr-1 scrollbar-hide">
                    {filteredEpisodes.map((ep) => (
                      <button
                        key={ep.episodeNumber}
                        onClick={() => handleEpisodeSelect(ep)}
                        className={`w-full text-center text-xs font-medium py-2 rounded-lg transition-all ${
                          currentEp === ep.episodeNumber
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-white/5 text-muted hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {formatEpNum(ep.episodeNumber)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* ===== ANIME INFO ===== */}
            {anime && (
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
                <div className="flex gap-5">
                  <div className="w-24 h-36 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-white/10 hidden sm:block">
                    <img src={anime.imageUrl} alt={anime.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-white text-xl font-bold font-display">{anime.title}</h1>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-[10px] bg-primary/15 text-primary font-bold px-2 py-0.5 rounded">{anime.type || 'TV'}</span>
                      <span className="text-[10px] bg-white/10 text-muted px-2 py-0.5 rounded">HD</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mt-4 text-xs">
                      {[
                        ['Type', anime.type || 'TV'],
                        ['Aired', anime.aired || 'Unknown'],
                        ['Score', anime.score || anime.rating || 'N/A'],
                        ['Episodes', String(episodes.length || anime.episodes || '?')],
                        ['Genres', anime.genres?.slice(0,3).map(g => typeof g === 'string' ? g : g.name).join(', ') || 'N/A'],
                        ['Status', anime.status || 'Unknown'],
                        ['Duration', anime.duration || 'Unknown'],
                        ['Studios', anime.studios?.map(s => typeof s === 'string' ? s : s.name).join(', ') || 'N/A'],
                      ].map(([label, value]) => (
                        <div key={label} className="flex gap-2">
                          <span className="text-muted whitespace-nowrap">{label}:</span>
                          <span className="text-white truncate">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== COMMENTS ===== */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
              <h3 className="text-white text-base font-bold mb-4">Comments</h3>
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">U</div>
                <div className="flex-1">
                  <textarea
                    placeholder="Add a comment..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-muted outline-none focus:border-primary/50 transition resize-none"
                  />
                  <div className="flex justify-end mt-2">
                    <button className="bg-primary hover:bg-primary/90 text-white text-xs font-medium px-5 py-2 rounded-lg transition-colors">Post</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ===== RIGHT COLUMN (~30%) ===== */}
          <div className="flex-[3] w-full lg:max-w-sm space-y-6">

            {/* Recommended */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
              <h3 className="text-white text-sm font-bold mb-3">Recommended</h3>
              {recommended.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-muted text-xs">Loading suggestions...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recommended.map((rec) => (
                    <Link key={rec.malId || rec.id} to={`/watch/${rec.malId || rec.id}/1`} className="flex gap-3 group">
                      <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-surface/50">
                        <img src={rec.imageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1 py-0.5">
                        <p className="text-xs text-white font-medium truncate group-hover:text-primary transition-colors">{rec.title}</p>
                        <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded mt-1 inline-block">{rec.type || 'TV'}</span>
                        <p className="text-[10px] text-muted mt-0.5">{rec.episodes || '?'} Episodes</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
