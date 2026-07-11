import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function AutoNextOverlay({ visible, nextEpisode, animeTitle, onPlay, onCancel, countdown = 10 }) {
  const [counter, setCounter] = useState(countdown)

  useEffect(() => {
    if (!visible) { setCounter(countdown); return }
    const timer = setInterval(() => {
      setCounter(c => {
        if (c <= 1) { clearInterval(timer); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [visible, countdown])

  useEffect(() => {
    if (visible && counter === 0) onPlay()
  }, [visible, counter, onPlay])

  return (
    <AnimatePresence>
      {visible && nextEpisode && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="absolute bottom-20 right-4 z-40 w-72 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl"
        >
          <div className="p-3 space-y-2">
            <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wider">Up Next</p>
            <p className="text-white text-sm font-medium truncate leading-tight">
              {nextEpisode.title || `Episode ${nextEpisode.episodeNumber}`}
            </p>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: countdown, ease: 'linear' }}
                />
              </div>
              <span className="text-white/60 text-[10px] font-mono min-w-[16px] text-right">{counter}s</span>
            </div>

            <p className="text-muted text-[10px]">Autoplay in {counter}s</p>
          </div>

          <div className="flex border-t border-white/10 divide-x divide-white/10">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onPlay}
              className="flex-1 py-2.5 text-xs text-primary font-semibold hover:bg-primary/10 transition-colors"
            >
              Play Now
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
