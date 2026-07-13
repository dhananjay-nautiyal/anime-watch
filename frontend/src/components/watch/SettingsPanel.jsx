import { motion, AnimatePresence } from 'framer-motion'

export default function SettingsPanel({
  show, sections, autoQuality, onAutoQualityToggle,
  onTogglePip, onToggleTheater, theater, onClose,
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="absolute bottom-8 right-0 bg-black/95 border border-white/10 rounded-xl p-2 shadow-2xl min-w-[200px] z-40 max-h-[60vh] overflow-y-auto"
        >
          {sections.map((section, si) => (
            <div key={section.title}>
              {si > 0 && <div className="h-px bg-white/10 my-1" />}
              <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5">{section.title}</p>
              {section.options.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { section.onChange(opt.value); onClose() }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    section.current === opt.value
                      ? 'bg-primary/20 text-primary font-medium'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ))}
          <div className="h-px bg-white/10 my-1" />
          <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5">Display</p>
          <button
            onClick={() => { onTogglePip(); onClose() }}
            className="w-full text-left px-3 py-1.5 text-xs text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
            </svg>
            Picture in Picture
          </button>
          <button
            onClick={() => { onToggleTheater(); onClose() }}
            className="w-full text-left px-3 py-1.5 text-xs text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            {theater ? 'Exit Theater' : 'Theater Mode'}
          </button>
          <div className="h-px bg-white/10 my-1" />
          <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5">Auto Quality</p>
          <button
            onClick={onAutoQualityToggle}
            className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${
              autoQuality
                ? 'bg-primary/20 text-primary font-medium'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            {autoQuality ? 'On' : 'Off'}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
