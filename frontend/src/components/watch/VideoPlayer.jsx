import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Hls from 'hls.js'

const STORAGE = {
  volume: 'aw_volume',
  speed: 'aw_speed',
}
const CONTROLS_HIDE_DELAY = 3000
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]
const SWIPE_THRESHOLD = 50

function fmt(sec) {
  if (!sec || !isFinite(sec)) return '0:00'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

function seekTooltipText(time, dur) {
  return fmt(time) + ' / ' + fmt(dur)
}

function proxyUrl(url, ref) {
  if (!url || url.startsWith('/api/stream/proxy')) return url
  return `/api/stream/proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(ref || 'https://anineko.to/')}`
}

export default function VideoPlayer({
  embedUrl, servers = [], poster, animeTitle, episodeNumber, animeId,
  onRetry, onChangeSource, streamType = 'hls', onEnded, onTimeUpdate, autoNext = true, autoPlay = true,
}) {
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const controlsTimer = useRef(null)
  const hlsRef = useRef(null)
  const seeking = useRef(false)
  const [state, setState] = useState({
    playing: false, currentTime: 0, duration: 0,
    volume: parseFloat(localStorage.getItem(STORAGE.volume) || '1'),
    muted: false, speed: parseFloat(localStorage.getItem(STORAGE.speed) || '1'),
    fullscreen: false, pip: false, buffering: true,
    showControls: true, showSettings: false, showVol: false,
    hasPoster: !autoPlay,
  })
  const st = useCallback((partial) => setState(prev => ({ ...prev, ...partial })), [])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }, [])

  const handleVolumeChange = useCallback((e) => {
    const v = parseFloat(e.target.value)
    videoRef.current.volume = v
    st({ volume: v, muted: v === 0 })
    localStorage.setItem(STORAGE.volume, String(v))
  }, [st])

  const handleSpeedChange = useCallback((s) => {
    if (videoRef.current) videoRef.current.playbackRate = s
    st({ speed: s, showSettings: false })
    localStorage.setItem(STORAGE.speed, String(s))
  }, [st])

  const toggleFullscreen = useCallback(() => {
    const c = containerRef.current
    if (!document.fullscreenElement) {
      c?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }, [])

  const togglePip = useCallback(async () => {
    try {
      const v = videoRef.current
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else if (v) await v.requestPictureInPicture()
    } catch {}
  }, [])

  const seek = useCallback((dir) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + dir * (dir > 100 ? 10 : 5)))
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onP = () => st({ playing: true, buffering: false, hasPoster: false })
    const onPa = () => st({ playing: false })
    const onT = () => {
      st({ currentTime: v.currentTime, duration: v.duration || 0 })
      if (onTimeUpdate) onTimeUpdate({ currentTime: v.currentTime, duration: v.duration || 0 })
    }
    const onW = () => st({ buffering: true })
    const onC = () => st({ buffering: false })
    const onE = () => { st({ playing: false }); if (autoNext && onEnded) onEnded() }
    v.addEventListener('play', onP)
    v.addEventListener('pause', onPa)
    v.addEventListener('timeupdate', onT)
    v.addEventListener('waiting', onW)
    v.addEventListener('canplay', onC)
    v.addEventListener('ended', onE)
    return () => {
      v.removeEventListener('play', onP)
      v.removeEventListener('pause', onPa)
      v.removeEventListener('timeupdate', onT)
      v.removeEventListener('waiting', onW)
      v.removeEventListener('canplay', onC)
      v.removeEventListener('ended', onE)
    }
  }, [autoNext, onEnded, onTimeUpdate, st])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.volume = state.volume
    v.muted = state.muted
    v.playbackRate = state.speed
  }, [state.volume, state.muted, state.speed])

  useEffect(() => {
    const onFs = () => st({ fullscreen: !!document.fullscreenElement })
    const onPiP = () => st({ pip: !!document.pictureInPictureElement })
    document.addEventListener('fullscreenchange', onFs)
    document.addEventListener('enterpictureinpicture', onPiP)
    document.addEventListener('leavepictureinpicture', onPiP)
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      document.removeEventListener('enterpictureinpicture', onPiP)
      document.removeEventListener('leavepictureinpicture', onPiP)
    }
  }, [st])

  useEffect(() => {
    if (state.showControls) {
      clearTimeout(controlsTimer.current)
      if (state.playing) {
        controlsTimer.current = setTimeout(() => {
          st({ showControls: false, showSettings: false, showVol: false })
        }, CONTROLS_HIDE_DELAY)
      }
    }
    return () => clearTimeout(controlsTimer.current)
  }, [state.showControls, state.playing, st])

  const showControls = state.showControls || state.buffering || !state.playing

  useEffect(() => {
    const v = videoRef.current
    if (!v || !embedUrl) return
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    v.removeAttribute('src')
    if (streamType === 'iframe') return

    const resumeKey = `aw_resume_${animeId}_${episodeNumber}`
    if (autoPlay) {
      const saved = localStorage.getItem(resumeKey)
      if (saved) {
        v.currentTime = parseFloat(saved)
        localStorage.removeItem(resumeKey)
      }
    }
    st({ buffering: true, hasPoster: !autoPlay })

    if (streamType === 'hls' && Hls.isSupported() && embedUrl.includes('.m3u8')) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true, maxBufferLength: 30 })
      hlsRef.current = hls
      hls.loadSource(proxyUrl(embedUrl))
      hls.attachMedia(v)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) v.play().catch(() => {})
      })
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          hls.destroy()
          hlsRef.current = null
        }
      })
    } else {
      v.src = proxyUrl(embedUrl, streamType === 'mp4' ? '' : undefined)
      if (autoPlay) v.play().catch(() => {})
    }
  }, [embedUrl, streamType, animeId, episodeNumber, autoPlay])

  useEffect(() => {
    const handleKb = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      switch (e.code) {
        case 'Space': e.preventDefault(); togglePlay(); break
        case 'ArrowLeft': e.preventDefault(); seek(-1); break
        case 'ArrowRight': e.preventDefault(); seek(1); break
        case 'ArrowUp': e.preventDefault(); st({ volume: Math.min(1, state.volume + 0.1) }); break
        case 'ArrowDown': e.preventDefault(); st({ volume: Math.max(0, state.volume - 0.1) }); break
        case 'KeyF': e.preventDefault(); toggleFullscreen(); break
        case 'KeyP': e.preventDefault(); togglePip(); break
        case 'KeyM': e.preventDefault(); st(p => ({ muted: !p.muted })); break
        case 'KeyR': e.preventDefault(); onRetry?.(); break
        case 'Escape': st({ showSettings: false }); break
      }
    }
    window.addEventListener('keydown', handleKb)
    return () => window.removeEventListener('keydown', handleKb)
  }, [togglePlay, seek, toggleFullscreen, togglePip, state.volume, state.muted, onRetry, st])

  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0

  const [hoverTime, setHoverTime] = useState(null)
  const [hoverPos, setHoverPos] = useState(0)

  const handleSeek = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width
    const v = videoRef.current
    if (v && v.duration) {
      v.currentTime = pos * v.duration
      seeking.current = false
    }
  }, [])

  const handleSeekMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setHoverPos(pos)
    const v = videoRef.current
    if (v?.duration) setHoverTime(pos * v.duration)
  }, [])

  // Touch gesture handling
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const touchStartTime = useRef(0)
  const [swipeIndicator, setSwipeIndicator] = useState(null)

  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    touchStartTime.current = Date.now()
  }, [])

  const handleTouchEnd = useCallback((e) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    const dt = Date.now() - touchStartTime.current

    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const v = videoRef.current
      if (v?.duration) {
        const seekAmount = dx > 0 ? -10 : 10
        v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seekAmount))
        setSwipeIndicator(seekAmount)
        setTimeout(() => setSwipeIndicator(null), 800)
      }
    } else if (dt < 300 && Math.abs(dx) < 20 && Math.abs(dy) < 20) {
      togglePlay()
    }
  }, [togglePlay])

  if (streamType === 'iframe') {
    return (
      <div ref={containerRef} className="w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl relative">
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allowFullScreen
          allow="autoplay; fullscreen"
          title={animeTitle}
        />
      </div>
    )
  }

  const volumeIcon = state.muted || state.volume === 0 ? 'Muted' : state.volume < 0.5 ? 'Low' : 'High'

  return (
    <div
      ref={containerRef}
      className="w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl relative group cursor-pointer touch-manipulation"
      onMouseMove={() => st({ showControls: true })}
      onMouseLeave={() => state.playing && st({ showControls: false })}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={togglePlay}
    >
      {state.hasPoster && poster && (
        <div className="absolute inset-0 z-10">
          <img src={poster} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40" />
          <button
            onClick={(e) => { e.stopPropagation(); const v = videoRef.current; v?.play().catch(() => {}) }}
            className="absolute inset-0 flex items-center justify-center"
            aria-label="Play"
          >
            <div className="w-20 h-20 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center transition-all hover:scale-110 shadow-2xl">
              <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </button>
        </div>
      )}

      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        preload="auto"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      />

      {state.buffering && state.playing && !state.hasPoster && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-20 pointer-events-none">
          <div className="w-10 h-10 border-[3px] border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent z-30 flex flex-col justify-end"
            onClick={(e) => e.stopPropagation()}
          >
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
                    {seekTooltipText(hoverTime, state.duration)}
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
                  <button onClick={(e) => { e.stopPropagation(); st(p => ({ showSettings: !p.showSettings })) }} className="text-white/80 hover:text-white transition-colors" aria-label="Settings">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81a.48.48 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.488.488 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.611 3.611 0 0112 15.6z"/></svg>
                  </button>
                  <AnimatePresence>
                    {state.showSettings && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute bottom-8 right-0 bg-black/95 border border-white/10 rounded-xl p-2 shadow-2xl min-w-[140px] z-40">
                        <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wider px-3 py-1">Speed</p>
                        {SPEEDS.map(s => (
                          <button key={s} onClick={() => handleSpeedChange(s)} className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${state.speed === s ? 'bg-primary/20 text-primary font-medium' : 'text-white/70 hover:text-white hover:bg-white/5'}`}>
                            {s}x{s === 1 ? ' (Normal)' : ''}
                          </button>
                        ))}
                        <div className="h-px bg-white/10 my-1" />
                        <button onClick={(e) => { e.stopPropagation(); togglePip() }} className="w-full text-left px-3 py-1.5 text-xs text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                          Picture in Picture
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button onClick={(e) => { e.stopPropagation(); toggleFullscreen() }} className="text-white/80 hover:text-white transition-colors" aria-label="Fullscreen">
                  {state.fullscreen ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {swipeIndicator && (
        <div className={`absolute top-1/2 -translate-y-1/2 z-40 bg-black/60 backdrop-blur-sm rounded-full w-16 h-16 flex items-center justify-center shadow-2xl pointer-events-none ${swipeIndicator > 0 ? 'left-4' : 'right-4'}`}>
          <svg className={`w-7 h-7 text-white ${swipeIndicator > 0 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
          </svg>
        </div>
      )}
    </div>
  )
}
