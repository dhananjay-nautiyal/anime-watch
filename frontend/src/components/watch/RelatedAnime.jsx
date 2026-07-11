import { useMemo, useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import ImageWithFallback from '../ImageWithFallback'

function ScrollButton({ direction, onClick, hidden }) {
  if (hidden) return null
  return (
    <button
      onClick={onClick}
      className="absolute top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all backdrop-blur-sm"
      style={{ [direction === 'left' ? 'left' : 'right']: '-12px' }}
      aria-label={`Scroll ${direction}`}
    >
      <svg className={`w-4 h-4 ${direction === 'right' ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

function AnimeCard({ item, compact }) {
  const id = item.malId || item.id
  if (!id) return null

  if (compact) {
    return (
      <Link
        to={`/watch/${id}/1`}
        className="group flex-shrink-0 w-[140px]"
      >
        <div className="aspect-[3/4] rounded-lg overflow-hidden bg-black/40 ring-1 ring-white/5 group-hover:ring-primary/30 transition-all">
          <ImageWithFallback
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
        <p className="text-xs text-white font-medium truncate mt-1.5 group-hover:text-primary transition-colors">{item.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {item.type && <span className="text-[9px] text-muted bg-white/5 px-1.5 py-0.5 rounded">{item.type}</span>}
          {item.score && (
            <span className="text-[9px] text-yellow-400 flex items-center gap-0.5">
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              {item.score}
            </span>
          )}
        </div>
      </Link>
    )
  }

  return (
    <Link
      to={`/watch/${id}/1`}
      className="group flex gap-3 flex-shrink-0 w-[260px] p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 transition-all"
    >
      <div className="w-16 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-black/40">
        <ImageWithFallback
          src={item.imageUrl}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-xs text-white font-medium truncate group-hover:text-primary transition-colors">{item.title}</p>
        <div className="flex items-center gap-1.5 mt-1">
          {item.type && <span className="text-[9px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-medium">{item.type}</span>}
          {item.score && (
            <span className="text-[9px] text-yellow-400 flex items-center gap-0.5">
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              {item.score}
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted mt-0.5">{item.episodes || '?'} Episodes</p>
      </div>
    </Link>
  )
}

export default function RelatedAnime({ items = [], title = 'Recommendations', malId, compact = false }) {
  const scrollRef = useRef(null)
  const [canScrollL, setCanScrollL] = useState(false)
  const [canScrollR, setCanScrollR] = useState(false)

  const filtered = useMemo(() => {
    if (!malId) return items
    return items.filter(item => String(item.malId || item.id) !== String(malId))
  }, [items, malId])

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollL(el.scrollLeft > 10)
    setCanScrollR(el.scrollLeft < el.scrollWidth - el.clientWidth - 10)
  }

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (el) {
      el.addEventListener('scroll', checkScroll)
      return () => el.removeEventListener('scroll', checkScroll)
    }
  }, [filtered])

  const scroll = (dir) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * 320, behavior: 'smooth' })
  }

  if (filtered.length === 0) return null

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
      <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
        {title}
      </h3>
      <div className="relative">
        <ScrollButton direction="left" onClick={() => scroll(-1)} hidden={!canScrollL} />
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-1"
          onScroll={checkScroll}
        >
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-6 w-full">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            filtered.map((item, i) => (
              <AnimeCard key={item.malId || item.id || i} item={item} compact={compact} />
            ))
          )}
        </div>
        <ScrollButton direction="right" onClick={() => scroll(1)} hidden={!canScrollR} />
      </div>
    </div>
  )
}
