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
    }, 8000)
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

  const slideVariants = {
    enter: (dir) => ({
      opacity: 0,
      scale: 1.1,
      x: dir > 0 ? 80 : -80,
    }),
    center: {
      opacity: 1,
      scale: 1,
      x: 0,
    },
    exit: (dir) => ({
      opacity: 0,
      scale: 0.95,
      x: dir > 0 ? -80 : 80,
    }),
  }

  const contentVariants = {
    enter: { opacity: 0, y: 50 },
    center: { opacity: 1, y: 0 },
  }

  const episodeCount = item.episodes ? `${item.episodes} Episodes` : '? Episodes'

  return (
    <section className="relative w-full overflow-hidden" style={{ height: 'min(85vh, 700px)', minHeight: '500px' }}>
      <div className="absolute inset-0">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={item.malId || idx}
            custom={direction}
            variants={slideVariants}
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

        <div className="absolute inset-0 bg-gradient-to-t from-[#080A16] via-[#080A16]/60 to-[#080A16]/5" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080A16]/90 via-[#080A16]/30 to-transparent" />
      </div>

      <div className="absolute inset-0 flex items-center">
        <div className="w-full px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={`content-${idx}`}
              variants={contentVariants}
              initial="enter"
              animate="center"
              exit="enter"
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="max-w-2xl"
            >
              <div className="flex flex-wrap items-center gap-2.5 mb-4">
                {item.type && (
                  <span className="bg-primary/15 text-primary text-[11px] font-bold px-3 py-1 rounded-lg border border-primary/20">
                    {item.type}
                  </span>
                )}
                <span className="text-white/50 text-xs font-medium">{episodeCount}</span>
                {item.status && (
                  <span className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                    item.status.toLowerCase().includes('airing')
                      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                      : item.status.toLowerCase().includes('finish') || item.status.toLowerCase().includes('complete')
                      ? 'text-blue-400 border-blue-500/30 bg-blue-500/10'
                      : 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
                  }`}>
                    {item.status.toLowerCase().includes('airing') && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                    {item.status}
                  </span>
                )}
                {item.rating && (
                  <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2.5 py-1 rounded-lg">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {item.rating}
                  </span>
                )}
              </div>

              <motion.h1 className="text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold font-display leading-tight mb-4 drop-shadow-lg">
                {item.title}
              </motion.h1>

              <motion.p className="text-white/50 text-sm md:text-base leading-relaxed line-clamp-3 mb-8 max-w-xl drop-shadow">
                {item.synopsis || 'No synopsis available.'}
              </motion.p>

              <motion.div className="flex items-center gap-3 flex-wrap">
                <Link
                  to={`/anime/${item.slug || item.malId || item.id}/ep/1`}
                  className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl font-semibold text-sm transition-all hover:shadow-glow hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  Watch Now
                </Link>
                <Link
                  to={`/anime/${item.slug || item.malId || item.id}`}
                  className="text-[#D1D5DB] hover:text-white px-6 py-3 rounded-xl text-sm font-medium transition-all hover:bg-white/[0.08] active:scale-95 backdrop-blur-md border border-white/[0.08] hover:border-white/[0.15]"
                >
                  More Info
                </Link>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="absolute bottom-8 right-4 md:right-10 flex items-center gap-2 z-10">
        {items.slice(0, 8).map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`relative h-1.5 rounded-full transition-all duration-500 overflow-hidden ${
              i === idx ? 'w-10 bg-white/15' : 'w-2 bg-white/20 hover:bg-white/40'
            }`}
            aria-label={`Go to slide ${i + 1}`}
          >
            {i === idx && (
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 8, ease: 'linear' }}
                className="absolute inset-0 bg-primary rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      <div className="absolute bottom-8 left-4 md:left-10 z-10">
        <span className="text-white/30 text-xs font-medium tracking-wider">
          {String(idx + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
        </span>
      </div>
    </section>
  )
})

export default HeroSection