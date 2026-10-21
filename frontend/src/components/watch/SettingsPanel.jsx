import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SHORT_TITLE = {
  'Video Quality': 'Quality',
  'Caption': 'Subtitles',
  'Playback Speed': 'Speed',
}

function labelFor(section) {
  const match = section.options.find(o => o.value === section.current)
  return match?.label || section.options[0]?.label || ''
}

function Chevron({ dir = 'right' }) {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d={dir === 'right' ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
    </svg>
  )
}

function Check() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function Switch({ on }) {
  return (
    <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-primary' : 'bg-white/20'}`}>
      <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
    </span>
  )
}

/**
 * Compact two-level settings menu, in the spirit of AnimeSuge/AniWatch:
 * the root lists Quality / Subtitles / Speed with their current value and
 * opens a submenu instead of dumping every option into one long column.
 */
export default function SettingsPanel({
  show, sections, autoQuality, onAutoQualityToggle,
  onTogglePip, onToggleTheater, theater, onClose,
}) {
  const [viewTitle, setViewTitle] = useState(null)

  useEffect(() => {
    if (!show) setViewTitle(null)
  }, [show])

  // Don't offer a subtitles menu when the stream has no subtitle tracks.
  const visibleSections = sections.filter(
    s => !(s.title === 'Caption' && s.options.length <= 1)
  )
  const section = visibleSections.find(s => s.title === viewTitle) || null

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.14 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-panel absolute bottom-9 right-0 w-[232px] rounded-2xl z-40 overflow-hidden"
        >
          <AnimatePresence mode="wait" initial={false}>
            {section ? (
              <motion.div
                key="submenu"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.12 }}
              >
                <button
                  onClick={() => setViewTitle(null)}
                  className="w-full flex items-center gap-1.5 px-2.5 py-2.5 text-white/90 hover:bg-white/5 transition-colors"
                >
                  <Chevron dir="left" />
                  <span className="text-[12px] font-semibold">
                    {SHORT_TITLE[section.title] || section.title}
                  </span>
                </button>
                <div className="max-h-[250px] overflow-y-auto pb-1">
                  {section.options.map(opt => {
                    const active = section.current === opt.value
                    if (opt.disabled) {
                      return (
                        <div
                          key={opt.value}
                          className="w-full flex items-center justify-between px-3 py-[7px] text-[12px] text-white/25 cursor-not-allowed"
                        >
                          <span>{opt.label}</span>
                          <span className="text-[10px] text-white/20">not available</span>
                        </div>
                      )
                    }
                    return (
                      <button
                        key={opt.value}
                        onClick={() => { section.onChange(opt.value); onClose() }}
                        className={`w-full flex items-center justify-between px-3 py-[7px] text-[12px] transition-colors ${
                          active ? 'text-primary' : 'text-white/70 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {active && <Check />}
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="root"
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 14 }}
                transition={{ duration: 0.12 }}
              >
                <div className="py-1">
                  {visibleSections.map(s => (
                    <button
                      key={s.title}
                      onClick={() => setViewTitle(s.title)}
                      className="w-full flex items-center justify-between px-3 py-2 group hover:bg-white/5 transition-colors"
                    >
                      <span className="text-[12px] text-white/80 group-hover:text-white">
                        {SHORT_TITLE[s.title] || s.title}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-white/40">
                        {labelFor(s)}
                        <Chevron />
                      </span>
                    </button>
                  ))}
                </div>

                <div className="h-px bg-white/[0.08]" />

                <div className="py-1">
                  <button
                    onClick={onAutoQualityToggle}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
                  >
                    <span className="text-[12px] text-white/80">Auto Quality</span>
                    <Switch on={autoQuality} />
                  </button>
                  <button
                    onClick={onToggleTheater}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
                  >
                    <span className="text-[12px] text-white/80">Theater Mode</span>
                    <Switch on={theater} />
                  </button>
                  <button
                    onClick={() => { onTogglePip(); onClose() }}
                    className="w-full flex items-center justify-between px-3 py-2 text-white/80 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <span className="text-[12px]">Picture in Picture</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M14 13h4v4h-4z" />
                    </svg>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
