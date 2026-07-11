import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { BannerImage } from './ImageWithFallback'

const HeroSection = memo(function HeroSection({ items }) {
  const [idx, setIdx] = useState(0)
  const [direction, setDirection] = useState(1)
  const timer = useRef(null)
  const item = items?.[idx]

  const startTimer = useCallback(() => {
    if (!items?.length || items.length < 2) return
    timer.current = setInterval(() => {
      setDirection(1)
      setIdx(p => (p + 1) % items.length)
    }, 7000)
  }, [items?.length])

  useEffect(() => {
    startTimer()
    return () => clearInterval(timer.current)
  }, [startTimer])

  const goTo = (i) => {
    clearInterval(timer.current)
    setDirection(i > idx ? 1 : -1)
    setIdx(i)
    startTimer()
  }

  if (!items?.length) return null

  const variants = {
    enter: (dir) => ({ opacity: 0, scale: 1.08, x: dir > 0 ? 100 : -100 }),
    center: { opacity: 1, scale: 1, x: 0 },
    exit: (dir) => ({ opacity: 0, scale: 0.95, x: dir > 0 ? -100 : 100 }),
  }

  const episodeCount = item.episodes ? `${item.episodes} Episodes` : 'Unknown Episodes'

  return (
    <section className="relative w-full overflow-hidden" style={{ paddingTop: '42.85%', maxHeight: '85vh' }}>
      <div className="absolute inset-0">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={item.malId || idx}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute inset-0"
          >
            <BannerImage
              src={item.imageUrl || item.images?.jpg?.large_image_url}
              alt=""
              className="scale-105"
            />
          </motion.div>
        </AnimatePresence>

        <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-[#050816]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050816]/90 via-transparent to-[#050816]/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050816]/10 to-[#050816]" />
      </div>

      <div className="absolute inset-0 flex items-end">
        <div className="w-full px-4 sm:px-6 lg:px-8 pb-10 md:pb-16 lg:pb-20">
          <motion.div
            key={`content-${idx}`}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="max-w-3xl"
          >
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="bg-primary/20 text-primary text-xs font-bold px-2.5 py-1 rounded-lg border border-primary/20">
                {item.rating || 'N/A'}
              </span>
              <span className="text-muted text-xs">{episodeCount}</span>
              <span className="px-2.5 py-1 bg-white/5 text-link text-xs rounded-lg border border-white/10">
                {item.type || 'TV'}
              </span>
              {item.year && (
                <span className="text-muted text-xs">{item.year}</span>
              )}
              {item.status && (
                <span className="text-xs text-secondary">{item.status}</span>
              )}
            </div>

            <motion.h1 className="text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold font-display leading-tight mb-3">
              {item.title}
            </motion.h1>

            <motion.p className="text-link/70 text-sm md:text-base leading-relaxed line-clamp-3 mb-6 max-w-2xl">
              {item.synopsis || 'No synopsis available.'}
            </motion.p>

            <motion.div className="flex items-center gap-3 flex-wrap">
              <Link
                to={`/anime/${item.slug || item.malId || item.id}/ep/1`}
                className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl font-semibold text-sm transition-all hover:shadow-glow hover:-translate-y-0.5 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                Watch Now
              </Link>
              <Link
                to={`/anime/${item.slug || item.malId || item.id}`}
                className="glass text-link hover:text-white px-6 py-3 rounded-xl text-sm font-medium transition-all hover:bg-white/10 hover:-translate-y-0.5 backdrop-blur-md"
              >
                More Info
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 md:right-10 flex gap-2 z-10">
        {items.slice(0, 8).map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === idx ? 'w-10 bg-primary shadow-glow' : 'w-3 bg-white/20 hover:bg-white/40'
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </section>
  )
})

export default HeroSection
