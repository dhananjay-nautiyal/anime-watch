import { memo, useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ImageWithFallback from './ImageWithFallback'

const ScrollArrow = memo(function ScrollArrow({ direction, onClick, visible }) {
  return (
    <button
      onClick={onClick}
      className={`absolute top-0 bottom-0 z-10 w-14 flex items-center justify-center transition-all duration-300 ${
        direction === 'left' ? 'left-0 bg-gradient-to-r from-body/90 to-transparent pl-2' : 'right-0 bg-gradient-to-l from-body/90 to-transparent pr-2'
      } ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      aria-label={`Scroll ${direction}`}
    >
      <div className={`w-[38px] h-[38px] rounded-full bg-[#141827]/90 backdrop-blur-md flex items-center justify-center text-white hover:bg-primary/80 hover:text-white transition-all border border-white/[0.06]`}>
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
        </svg>
      </div>
    </button>
  )
})

const SectionCard = memo(function SectionCard({ anime, index }) {
  const rating = anime.score || anime.rating
  const displayRating = rating ? parseFloat(rating) : null
  const episodeCount = anime.episodes || 0
  const isHD = displayRating && displayRating >= 7.5

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.4, delay: index * 0.03 }}
      className="flex-shrink-0 group"
    >
      <Link to={`/anime/${anime.slug || anime.malId || anime.id}/ep/1`} className="block relative">
        <div className="relative rounded-[14px] overflow-hidden bg-card transition-all duration-500 group-hover:shadow-glow group-hover:shadow-primary/20 group-hover:-translate-y-1.5 group-hover:scale-[1.02]"
          style={{ width: '190px', height: '270px' }}>
          <ImageWithFallback
            src={anime.imageUrl || anime.images?.jpg?.image_url}
            alt={anime.title}
            className="group-hover:scale-110 transition-transform duration-700"
            aspectRatio=""
            containerClass="w-full h-full"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent z-10" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors duration-300 z-10" />
            <div className="absolute inset-0 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-glow transform scale-0 group-hover:scale-100 transition-transform duration-300 delay-100">
                <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </ImageWithFallback>

          <div className="absolute top-2 left-2 z-30">
            {displayRating && (
              <span className="bg-black/80 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-lg">
                <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {displayRating}
              </span>
            )}
          </div>
          <div className="absolute top-2 right-2 z-30 flex flex-col gap-1 items-end">
            {isHD && (
              <span className="bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-lg">
                HD
              </span>
            )}
            {episodeCount > 0 && (
              <span className="bg-black/80 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-lg whitespace-nowrap">
                {episodeCount} eps
              </span>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/95 via-black/70 to-transparent z-30">
            <p className="text-white text-xs font-semibold line-clamp-2 drop-shadow-sm leading-tight">
              {anime.title}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              {anime.type && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-white/10 bg-white/10 text-link">
                  {anime.type}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
})

const SectionRow = memo(function SectionRow({ title, viewAllLink, items = [], isLoading, icon }) {
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
    const amount = direction === 'left' ? -500 : 500
    el.scrollBy({ left: amount, behavior: 'smooth' })
  }

  if (isLoading) {
    return (
      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="skeleton h-7 w-48 rounded" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 skeleton w-[190px] aspect-[3/4] rounded-[14px]" />
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
          {icon && <span className="text-primary text-lg">{icon}</span>}
          <h2 className="text-white text-xl md:text-2xl font-bold font-display">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              onClick={() => scroll('left')}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                canScrollLeft ? 'bg-white/[0.06] text-white hover:bg-white/[0.12]' : 'bg-white/[0.03] text-white/20 cursor-default'
              }`}
              aria-label="Scroll left"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => scroll('right')}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                canScrollRight ? 'bg-white/[0.06] text-white hover:bg-white/[0.12]' : 'bg-white/[0.03] text-white/20 cursor-default'
              }`}
              aria-label="Scroll right"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {viewAllLink && (
            <Link to={viewAllLink} className="text-sm text-[#9CA3AF] hover:text-white transition-colors font-medium">
              View All →
            </Link>
          )}
        </div>
      </div>
      <div className="relative group">
        <ScrollArrow direction="left" onClick={() => scroll('left')} visible={canScrollLeft} />
        <div
          ref={scrollRef}
          className="overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2"
        >
          <div className="flex gap-[14px]" style={{ minWidth: 'max-content' }}>
            {items.map((anime, i) => (
              <SectionCard key={`${anime.malId || anime.id}-${i}`} anime={anime} index={i} />
            ))}
          </div>
        </div>
        <ScrollArrow direction="right" onClick={() => scroll('right')} visible={canScrollRight} />
      </div>
    </section>
  )
})

export default SectionRow
