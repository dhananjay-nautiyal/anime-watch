import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const COUNTDOWN = 5

export default function AutoNextOverlay({ visible, onNext, onCancel, nextEpisode }) {
  const [count, setCount] = useState(COUNTDOWN)
  const timer = useRef(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!visible) {
      setCount(COUNTDOWN)
      clearTimeout(timer.current)
      return
    }

    setCount(COUNTDOWN)
    timer.current = setTimeout(() => {
      if (mounted.current) onNext()
    }, COUNTDOWN * 1000)

    const interval = setInterval(() => {
      if (mounted.current) setCount(p => {
        if (p <= 1) {
          clearInterval(interval)
          return 0
        }
        return p - 1
      })
    }, 1000)

    return () => {
      clearTimeout(timer.current)
      clearInterval(interval)
    }
  }, [visible, onNext])

  if (!visible || !nextEpisode) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="bg-gradient-to-r from-black/90 to-black/70 backdrop-blur-sm border border-white/10 rounded-xl p-4 flex items-center gap-4"
      >
        <div className="relative w-12 h-12 flex-shrink-0">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="16" fill="none" stroke="white/10" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="16" fill="none"
              stroke="currentColor" strokeWidth="3"
              strokeDasharray={`${(count / COUNTDOWN) * 100} 100`}
              className="text-primary transition-all duration-1000"
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">{count}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-medium">Next episode starting soon</p>
          <p className="text-muted text-[11px] truncate mt-0.5">
            EP {nextEpisode.episodeNumber}{nextEpisode.title ? ` - ${nextEpisode.title}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="text-xs text-muted hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={onNext}
            className="text-xs text-white bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap font-medium"
          >
            Play Now
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
