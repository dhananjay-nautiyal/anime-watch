import { memo, useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ImageWithFallback from './ImageWithFallback'

const ContinueCard = memo(function ContinueCard({ item }) {
  const progress = item.durationSeconds > 0 ? item.progressSeconds / item.durationSeconds : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="flex-shrink-0 group"
    >
      <Link to={`/anime/${item.slug || item.malId}/ep/${item.episodeNumber}`} className="block">
        <div className="relative rounded-xl overflow-hidden bg-surface/50 border border-white/[0.03] transition-all duration-500 group-hover:shadow-glow group-hover:shadow-primary/20 group-hover:-translate-y-1 group-hover:border-primary/20"
          style={{ width: '260px', height: '146px' }}>
          <ImageWithFallback
            src={item.animeImage}
            alt={item.animeTitle}
            className="group-hover:scale-105 transition-transform duration-500"
            aspectRatio=""
            containerClass="w-full h-full"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
            <div className="absolute inset-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center bg-black/40">
              <div className="w-12 h-12 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-glow transform scale-0 group-hover:scale-100 transition-transform duration-300">
                <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </ImageWithFallback>
          <div className="absolute bottom-0 left-0 right-0 p-3 z-20">
            <p className="text-white text-sm font-medium truncate drop-shadow-md">{item.animeTitle}</p>
            <p className="text-xs text-muted mt-0.5">Episode {item.episodeNumber}</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-20">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-r transition-all duration-700"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
        </div>
      </Link>
    </motion.div>
  )
})

const ContinueWatching = memo(function ContinueWatching({ items = [], isLoading }) {
  const scrollRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const updateScrollState = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 10)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollState, { passive: true })
    updateScrollState()
    return () => el.removeEventListener('scroll', updateScrollState)
  }, [items])

  const scroll = (direction) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: direction === 'left' ? -500 : 500, behavior: 'smooth' })
  }

  if (isLoading) {
    return (
      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="skeleton w-5 h-5 rounded" />
            <div className="skeleton h-7 w-48 rounded" />
          </div>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 skeleton w-[260px] aspect-video rounded-xl" />
          ))}
        </div>
      </section>
    )
  }

  if (!items.length) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <h2 className="text-white text-xl md:text-2xl font-bold font-display">Continue Watching</h2>
        </div>
        <div className="hidden sm:flex items-center gap-1">
          <button onClick={() => scroll('left')} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${canScrollLeft ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white/5 text-white/20 cursor-default'}`} aria-label="Scroll left">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={() => scroll('right')} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${canScrollRight ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white/5 text-white/20 cursor-default'}`} aria-label="Scroll right">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2">
        <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
          {items.slice(0, 10).map((item, i) => (
            <ContinueCard key={`${item.malId}-${i}`} item={item} />
          ))}
        </div>
      </div>
    </section>
  )
})

export default ContinueWatching
