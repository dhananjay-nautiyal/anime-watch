import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SettingsPanel from './SettingsPanel'

function fmt(sec) {
  if (!sec || !isFinite(sec)) return '0:00'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

export default function ControlsBar({
  state, st, progress, videoRef,
  togglePlay, seek, toggleFullscreen, togglePip, toggleTheater,
  handleShare, onRetry, handleVolumeChange, handleSpeedChange,
  handleQualityChange, handleAutoQualityToggle, handleSubtitleChange,
  settingsSections,
  animeTitle, episodeNumber, currentLanguage,
}) {
  const [hoverTime, setHoverTime] = useState(null)
  const [hoverPos, setHoverPos] = useState(0)

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width
    const v = videoRef.current
    if (v && v.duration) {
      v.currentTime = pos * v.duration
    }
  }

  const handleSeekMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setHoverPos(pos)
    const v = videoRef.current
    if (v?.duration) setHoverTime(pos * v.duration)
  }

  const volumeIcon = state.muted || state.volume === 0 ? 'Muted' : state.volume < 0.5 ? 'Low' : 'High'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent z-30 flex flex-col justify-end"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-white/90 text-sm font-medium truncate drop-shadow-lg">
            {animeTitle}{episodeNumber ? ` - Episode ${episodeNumber}` : ''}
          </p>
          {currentLanguage && (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-[9px] bg-emerald-500/20 backdrop-blur-sm text-emerald-400 px-1.5 py-0.5 rounded font-medium">{currentLanguage}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); st(p => ({ showShortcuts: !p.showShortcuts })) }}
            className="text-white/60 hover:text-white bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-lg p-1.5 transition-all"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleShare() }}
            className="text-white/60 hover:text-white bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-lg p-1.5 transition-all"
            aria-label="Share"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
          {onRetry && (
            <button
              onClick={(e) => { e.stopPropagation(); onRetry() }}
              className="text-white/60 hover:text-white bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-lg p-1.5 transition-all"
              aria-label="Retry"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pb-3 space-y-2">
        <div
          className="relative h-1 bg-white/20 rounded-full cursor-pointer group/seek"
          onClick={handleSeek}
          onMouseMove={handleSeekMove}
          onMouseLeave={() => setHoverTime(null)}
        >
          <div className="h-full bg-primary/50 rounded-full" style={{ width: `${progress}%` }} />
          <div className="absolute top-0 left-0 h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
          <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-primary rounded-full shadow-lg opacity-0 group-hover/seek:opacity-100 transition" style={{ left: `calc(${progress}% - 7px)` }} />
          {hoverTime !== null && (
            <div className="absolute -top-8 -translate-x-1/2 bg-black/90 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap" style={{ left: `${hoverPos * 100}%` }}>
              {fmt(hoverTime)} / {fmt(state.duration)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={(e) => { e.stopPropagation(); togglePlay() }} className="text-white hover:text-primary transition-colors" aria-label={state.playing ? 'Pause' : 'Play'}>
            {state.playing ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>

          {!state.theater && (
            <button onClick={(e) => { e.stopPropagation(); seek(-10) }} className="text-white/60 hover:text-white transition-colors" aria-label="Rewind 10 seconds">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
              </svg>
            </button>
          )}
          {!state.theater && (
            <button onClick={(e) => { e.stopPropagation(); seek(10) }} className="text-white/60 hover:text-white transition-colors" aria-label="Forward 10 seconds">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
              </svg>
            </button>
          )}

          <div className="relative flex items-center">
            <button onClick={(e) => { e.stopPropagation(); st(p => ({ showVol: !p.showVol })) }} className="text-white/80 hover:text-white transition-colors" aria-label="Volume">
              {volumeIcon === 'Muted' ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
              )}
            </button>
            <AnimatePresence>
              {state.showVol && (
                <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 80, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="overflow-hidden">
                  <input type="range" min="0" max="1" step="0.05" value={state.muted ? 0 : state.volume} onChange={handleVolumeChange} className="w-20 h-1 accent-primary cursor-pointer" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <span className="text-white/60 text-[11px] font-mono min-w-[80px]">{fmt(state.currentTime)} / {fmt(state.duration)}</span>

          <div className="flex-1" />

          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); st(p => ({ showSettings: !p.showSettings })) }}
              className="text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-1.5 rounded-lg"
              aria-label="Settings"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81a.48.48 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.488.488 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.611 3.611 0 0112 15.6z"/></svg>
            </button>
            <SettingsPanel
              show={state.showSettings}
              sections={settingsSections}
              autoQuality={state.autoQuality}
              onAutoQualityToggle={handleAutoQualityToggle}
              onTogglePip={togglePip}
              onToggleTheater={toggleTheater}
              theater={state.theater}
              onClose={() => st({ showSettings: false })}
            />
          </div>

          <button onClick={(e) => { e.stopPropagation(); toggleFullscreen() }} className="text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-1.5 rounded-lg" aria-label="Fullscreen">
            {state.fullscreen ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
