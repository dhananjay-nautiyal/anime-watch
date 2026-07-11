import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const PAGE_SIZE = 30

function fmtNum(n) {
  return String(n).padStart(3, '0')
}

function EpisodeGridCell({ episode, malId, isActive, isWatched, progress, onSelect }) {
  const progressPct = progress > 0 ? Math.min(progress, 100) : 0

  return (
    <button
      onClick={() => onSelect(episode)}
      className={`relative flex flex-col items-center justify-center w-full aspect-square rounded-lg text-xs font-medium transition-all duration-200 group border ${
        isActive
          ? 'bg-primary/15 border-primary/40 text-primary shadow-lg shadow-primary/10 ring-1 ring-primary/30'
          : isWatched
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15 hover:border-emerald-500/40'
            : 'bg-white/[0.04] border-white/10 text-white/70 hover:bg-white/[0.08] hover:border-white/20 hover:text-white'
      }`}
      aria-current={isActive ? 'true' : undefined}
      aria-label={`Episode ${episode.episodeNumber}`}
    >
      {episode.filler && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-400 rounded-full z-10" title="Filler" />
      )}
      {episode.recap && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-400 rounded-full z-10" title="Recap" />
      )}
      <span className={`font-bold ${isActive ? 'text-primary' : ''}`}>{fmtNum(episode.episodeNumber)}</span>
      {progressPct > 0 && !isActive && (
        <div className="absolute bottom-1 left-1 right-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      )}
      {isActive && (
        <svg className="w-3.5 h-3.5 text-primary absolute -bottom-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      )}
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
    if (!malId) return
    navigate(`/anime/${malId}/ep/${ep.episodeNumber}`, { replace: true })
    onSelect(ep)
  }, [malId, navigate, onSelect])

  useEffect(() => {
    if (listRef.current) {
      const active = listRef.current.querySelector('[aria-current="true"]')
      if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
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
            <button onClick={onRetry} className="bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium px-4 py-2 rounded-lg transition-all">Retry</button>
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
            <button onClick={onRetry} className="bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium px-4 py-2 rounded-lg transition-all">Check again</button>
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
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors" aria-label="Clear search">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              ) : (
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              )}
            </div>
          </div>
        )}
      </div>

      {showList && (
        <div ref={listRef} className="overflow-y-auto max-h-[480px] p-3 episode-sidebar" role="list" aria-label="Episode list">
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted text-xs">No episodes match</p>
            </div>
          ) : (
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
              {filtered.map((ep) => (
                <EpisodeGridCell
                  key={ep.episodeNumber}
                  episode={ep}
                  malId={malId}
                  isActive={currentEp === ep.episodeNumber}
                  isWatched={false}
                  progress={0}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
