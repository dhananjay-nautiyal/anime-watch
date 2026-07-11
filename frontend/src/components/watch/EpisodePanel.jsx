import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ImageWithFallback from '../ImageWithFallback'

const PAGE_SIZE = 30

function fmtNum(n) {
  return String(n).padStart(3, '0')
}

function EpisodeCard({ episode, malId, isActive, progress, onSelect }) {
  return (
    <button
      onClick={() => onSelect(episode)}
      className={`w-full text-left flex gap-3 p-2.5 rounded-xl transition-all duration-200 group ${
        isActive
          ? 'bg-primary/10 border border-primary/20'
          : 'hover:bg-white/[0.04] border border-transparent'
      }`}
      aria-current={isActive ? 'true' : undefined}
    >
      <div className="relative w-24 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-black/40">
        {episode.thumbnail || episode.imageUrl ? (
          <ImageWithFallback
            src={episode.thumbnail || episode.imageUrl}
            alt={`Episode ${episode.episodeNumber}`}
            className="group-hover:scale-105 transition-transform duration-300"
            containerClass="w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}
        {progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
            <div className="h-full bg-primary rounded-r transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
        )}
        {isActive && (
          <div className="absolute inset-0 ring-2 ring-primary/50 rounded-lg" />
        )}
      </div>
      <div className="flex-1 min-w-0 py-0.5">
        <p className="text-[11px] text-muted font-medium">EP {episode.episodeNumber}</p>
        <p className="text-sm text-white font-medium truncate">
          {episode.title || `Episode ${episode.episodeNumber}`}
        </p>
        {(episode.duration || episode.airDate) && (
          <p className="text-[11px] text-muted mt-0.5">
            {episode.duration && <span>{episode.duration}</span>}
            {episode.duration && episode.airDate && <span className="mx-1">·</span>}
            {episode.airDate && <span>{episode.airDate}</span>}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          {episode.filler && (
            <span className="text-[9px] bg-yellow-500/15 text-yellow-400 px-1.5 py-0.5 rounded font-medium">Filler</span>
          )}
          {episode.recap && (
            <span className="text-[9px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded font-medium">Recap</span>
          )}
        </div>
      </div>
    </button>
  )
}

export default function EpisodePanel({
  episodes = [], currentEp, onSelect, syncing, error, onRetry, malId,
}) {
  const navigate = useNavigate()
  const [rangeIdx, setRangeIdx] = useState(0)
  const [search, setSearch] = useState('')
  const listRef = useRef(null)

  const ranges = useMemo(() => {
    if (episodes.length === 0) return []
    const r = []
    for (let i = 1; i <= episodes.length; i += PAGE_SIZE) {
      const end = Math.min(i + PAGE_SIZE - 1, episodes.length)
      r.push({ start: i, end, label: `${fmtNum(i)}–${fmtNum(end)}` })
    }
    return r
  }, [episodes])

  const filtered = useMemo(() => {
    const range = ranges[rangeIdx]
    const inRange = range
      ? episodes.filter(e => e.episodeNumber >= range.start && e.episodeNumber <= range.end)
      : episodes
    if (!search) return inRange
    const q = search.trim()
    return inRange.filter(e => String(e.episodeNumber).includes(q))
  }, [episodes, rangeIdx, ranges, search])

  const handleSelect = useCallback((ep) => {
    onSelect(ep)
  }, [onSelect])

  useEffect(() => {
    if (listRef.current) {
      const active = listRef.current.querySelector('[aria-current="true"]')
      if (active) {
        active.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [currentEp])

  const showList = !syncing && !error && episodes.length > 0

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white text-sm font-bold flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Episodes
          </h2>
          {showList && (
            <span className="text-[11px] text-muted bg-white/5 px-2 py-0.5 rounded-full font-medium">{episodes.length}</span>
          )}
        </div>

        {syncing && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-8 h-8 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-muted text-xs">Loading episodes from providers...</p>
          </div>
        )}

        {!syncing && error && (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-muted text-xs mb-3 px-4">{error}</p>
            <button
              onClick={onRetry}
              className="bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium px-4 py-2 rounded-lg transition-all"
            >
              Retry
            </button>
          </div>
        )}

        {!syncing && !error && episodes.length === 0 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-muted text-xs mb-1">No episodes available</p>
            <p className="text-muted/50 text-[10px] mb-3">This title may not be available yet</p>
            <button
              onClick={onRetry}
              className="bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium px-4 py-2 rounded-lg transition-all"
            >
              Check again
            </button>
          </div>
        )}

        {showList && (
          <div className="flex items-center gap-2">
            <select
              value={rangeIdx}
              onChange={(e) => { setRangeIdx(Number(e.target.value)); setSearch('') }}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-primary/50 transition flex-1 cursor-pointer appearance-none"
              aria-label="Episode range"
            >
              {ranges.map((r, i) => (
                <option key={i} value={i} className="bg-[#0a0a0f]">{r.label}</option>
              ))}
            </select>
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-3 pr-8 py-1.5 text-xs text-white placeholder-muted outline-none focus:border-primary/50 transition"
                aria-label="Search episodes"
              />
              {search ? (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors"
                  aria-label="Clear search"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : (
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </div>
          </div>
        )}
      </div>

      {showList && (
          <div ref={listRef} className="overflow-y-auto max-h-[480px] episode-sidebar" role="list" aria-label="Episode list">
          <div className="p-2 space-y-0.5">
            {filtered.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted text-xs">No episodes match your search</p>
              </div>
            ) : (
              filtered.map((ep) => (
                <EpisodeCard
                  key={ep.episodeNumber}
                  episode={ep}
                  malId={malId}
                  isActive={currentEp === ep.episodeNumber}
                  progress={0}
                  onSelect={handleSelect}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
