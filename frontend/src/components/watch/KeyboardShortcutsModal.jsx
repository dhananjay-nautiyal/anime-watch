import { motion, AnimatePresence } from 'framer-motion'

const KB_SHORTCUTS = [
  { key: 'Space', action: 'Play/Pause' },
  { key: '\u2190', action: 'Rewind 5s' },
  { key: '\u2192', action: 'Forward 5s' },
  { key: '\u2191', action: 'Volume Up' },
  { key: '\u2193', action: 'Volume Down' },
  { key: 'F', action: 'Fullscreen' },
  { key: 'T', action: 'Theater' },
  { key: 'M', action: 'Mute' },
]

export default function KeyboardShortcutsModal({ show, onClose }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); onClose() }}
        >
          <div className="bg-surface/95 border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-sm font-bold">Keyboard Shortcuts</h3>
              <button onClick={onClose} className="text-muted hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              {KB_SHORTCUTS.map(({ key, action }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-muted">{action}</span>
                  <kbd className="px-2 py-0.5 text-[10px] font-mono bg-white/10 text-white rounded border border-white/10 min-w-[24px] text-center">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
