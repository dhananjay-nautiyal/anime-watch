import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Hls from 'hls.js'
import ControlsBar from './ControlsBar'
import KeyboardShortcutsModal from './KeyboardShortcutsModal'

const STORAGE = {
  volume: 'aw_volume',
  speed: 'aw_speed',
  quality: 'aw_quality',
  theater: 'aw_theater',
  autoQuality: 'aw_auto_quality',
}
const CONTROLS_HIDE_DELAY = 3000
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
const SWIPE_THRESHOLD = 50

export default function VideoPlayer({
  embedUrl, poster, animeTitle, episodeNumber, animeId,
  onRetry, streamType = 'hls', onEnded, onTimeUpdate, autoNext = true, autoPlay = true,
  onSwipeUp, onSwipeDown,
  currentLanguage, onReady, onError, streamKey,
}) {
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const controlsTimer = useRef(null)
  const hlsRef = useRef(null)
  const seeking = useRef(false)
  const readyFired = useRef(false)

  const [state, setState] = useState({
    playing: false, currentTime: 0, duration: 0,
    volume: parseFloat(localStorage.getItem(STORAGE.volume) || '1'),
    muted: false, speed: parseFloat(localStorage.getItem(STORAGE.speed) || '1'),
    fullscreen: false, pip: false, buffering: true,
    showControls: true, showSettings: false, showVol: false,
    hasPoster: !autoPlay,
    qualities: [], currentQuality: -1,
    autoQuality: localStorage.getItem(STORAGE.autoQuality) !== 'false',
    theater: localStorage.getItem(STORAGE.theater) === 'true',
    subtitles: [], currentSubtitle: -1,
    showShortcuts: false,
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
    st({ speed: s })
    localStorage.setItem(STORAGE.speed, String(s))
  }, [st])

  const handleQualityChange = useCallback((level) => {
    const hls = hlsRef.current
    if (hls) {
      hls.currentLevel = level
      if (level === -1) {
        localStorage.removeItem(STORAGE.quality)
      } else {
        localStorage.setItem(STORAGE.quality, String(level))
      }
    }
    st({ currentQuality: level })
  }, [st])

  const handleAutoQualityToggle = useCallback(() => {
    st(p => {
      const next = !p.autoQuality
      localStorage.setItem(STORAGE.autoQuality, String(next))
      const hls = hlsRef.current
      if (hls) {
        hls.currentLevel = next ? -1 : (p.currentQuality >= 0 ? p.currentQuality : 0)
      }
      return { autoQuality: next }
    })
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

  const toggleTheater = useCallback(() => {
    st(p => ({ theater: !p.theater }))
    localStorage.setItem(STORAGE.theater, String(!state.theater))
  }, [st, state.theater])

  const handleShare = useCallback(async () => {
    try {
      const url = window.location.href
      if (navigator.share) {
        await navigator.share({ title: animeTitle, url })
      } else {
        await navigator.clipboard.writeText(url)
      }
    } catch {}
  }, [animeTitle])

  const handleSubtitleChange = useCallback((idx) => {
    const hls = hlsRef.current
    if (hls && hls.subtitleTrack !== undefined) {
      hls.subtitleTrack = idx
    }
    st({ currentSubtitle: idx })
  }, [st])

  const seek = useCallback((dir) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + dir))
  }, [])

  const skipIntro = useCallback(() => {
    const v = videoRef.current
    if (v) v.currentTime = Math.min(v.duration, 95)
  }, [])

  const showSkipIntro = state.currentTime > 0 && state.currentTime < 90 && state.duration > 120

  useEffect(() => {
    readyFired.current = false
  }, [embedUrl, streamKey])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onP = () => {
      st({ playing: true, buffering: false, hasPoster: false })
      if (!readyFired.current) {
        readyFired.current = true
        onReady?.()
      }
    }
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
    v.addEventListener('error', () => {
      const medErr = v.error
      if (medErr) {
        onError?.(medErr.message || `Media error code ${medErr.code}`)
      }
    })
    return () => {
      v.removeEventListener('play', onP)
      v.removeEventListener('pause', onPa)
      v.removeEventListener('timeupdate', onT)
      v.removeEventListener('waiting', onW)
      v.removeEventListener('canplay', onC)
      v.removeEventListener('ended', onE)
    }
  }, [autoNext, onEnded, onTimeUpdate, st, onReady, onError])

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
    if (!v || !embedUrl) {
      return
    }
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    v.removeAttribute('src')
    if (streamType === 'iframe') {
      return
    }

    const resumeKey = `aw_resume_${animeId}_${episodeNumber}`
    if (autoPlay) {
      const saved = localStorage.getItem(resumeKey)
      if (saved) {
        v.currentTime = parseFloat(saved)
        localStorage.removeItem(resumeKey)
      }
    }
    st({ buffering: true, hasPoster: !autoPlay, qualities: [], currentQuality: -1 })

    if (streamType === 'hls' && Hls.isSupported() && embedUrl.includes('.m3u8')) {
      const hlsUrl = embedUrl.startsWith('/api/stream/proxy') ? embedUrl : `/api/stream/proxy?url=${encodeURIComponent(embedUrl)}&referer=https://anineko.to/`
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true, maxBufferLength: 30 })
      hlsRef.current = hls
      hls.loadSource(hlsUrl)
      hls.attachMedia(v)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const qualities = hls.levels.map((l, i) => ({
          index: i, height: l.height, width: l.width, bitrate: l.bitrate,
          label: l.height ? `${l.height}p` : `Quality ${i}`,
        }))
        st({ qualities })
        const savedAuto = localStorage.getItem(STORAGE.autoQuality) !== 'false'
        if (savedAuto) {
          hls.currentLevel = -1
          st({ currentQuality: -1, autoQuality: true })
        } else {
          const saved = parseInt(localStorage.getItem(STORAGE.quality))
          if (saved >= 0 && saved < hls.levels.length) {
            hls.currentLevel = saved
            st({ currentQuality: saved, autoQuality: false })
          }
        }
        if (autoPlay) v.play().catch(() => {})
      })
      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        st({ currentQuality: data.level })
      })
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
        const subtitleTracks = data.subtitleTracks || []
        st({ subtitles: subtitleTracks.map((t, i) => ({ index: i, label: t.label, lang: t.lang })) })
      })
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          st({ buffering: false })
          onError?.(`HLS error: ${data.type} - ${data.details}`)
          hls.destroy()
          hlsRef.current = null
        }
      })
    } else {
      const directSrc = embedUrl.startsWith('/api/stream/proxy') ? embedUrl : `/api/stream/proxy?url=${encodeURIComponent(embedUrl)}`
      v.src = directSrc
      if (autoPlay) v.play().catch(() => {})
    }
  }, [embedUrl, streamType, animeId, episodeNumber, autoPlay, st, streamKey, onError])

  useEffect(() => {
    const handleKb = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      switch (e.code) {
        case 'Space': e.preventDefault(); togglePlay(); break
        case 'ArrowLeft': e.preventDefault(); seek(-5); break
        case 'ArrowRight': e.preventDefault(); seek(5); break
        case 'ArrowUp': e.preventDefault(); st({ volume: Math.min(1, state.volume + 0.1) }); break
        case 'ArrowDown': e.preventDefault(); st({ volume: Math.max(0, state.volume - 0.1) }); break
        case 'KeyF': e.preventDefault(); toggleFullscreen(); break
        case 'KeyP': e.preventDefault(); togglePip(); break
        case 'KeyM': e.preventDefault(); st(p => ({ muted: !p.muted })); break
        case 'KeyR': e.preventDefault(); onRetry?.(); break
        case 'KeyT': e.preventDefault(); toggleTheater(); break
        case 'KeyS': e.preventDefault(); handleShare(); break
        case 'Slash': e.preventDefault(); st(p => ({ showShortcuts: !p.showShortcuts })); break
        case 'Escape': st({ showSettings: false, showShortcuts: false }); break
      }
    }
    window.addEventListener('keydown', handleKb)
    return () => window.removeEventListener('keydown', handleKb)
  }, [togglePlay, seek, toggleFullscreen, togglePip, state.volume, state.muted, onRetry, st])

  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0

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
    } else if (Math.abs(dy) > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx) * 1.5 && dt < 500) {
      if (dy < 0 && onSwipeUp) { onSwipeUp(); setSwipeIndicator(-30); setTimeout(() => setSwipeIndicator(null), 800) }
      else if (dy > 0 && onSwipeDown) { onSwipeDown(); setSwipeIndicator(30); setTimeout(() => setSwipeIndicator(null), 800) }
    } else if (dt < 300 && Math.abs(dx) < 20 && Math.abs(dy) < 20) {
      togglePlay()
    }
  }, [togglePlay, onSwipeUp, onSwipeDown])

  if (streamType === 'iframe') {
    return (
      <div ref={containerRef} className="w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl relative">
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allowFullScreen
          allow="autoplay; fullscreen"
          title={animeTitle}
          onLoad={() => onReady?.()}
        />
      </div>
    )
  }

  const settingsSections = useMemo(() => {
    const sections = []

    const qualityOptions = [{ label: 'Auto', value: -1 }]
    if (state.qualities.length > 0) {
      state.qualities.forEach(q => {
        qualityOptions.push({ label: q.label, value: q.index })
      })
    }
    sections.push({
      title: 'Video Quality',
      options: qualityOptions,
      current: state.currentQuality,
      onChange: handleQualityChange,
    })

    const captionOptions = [{ label: 'Off', value: -1 }]
    if (state.subtitles.length > 0) {
      state.subtitles.forEach(s => {
        captionOptions.push({ label: `${s.label} (${s.lang || 'unknown'})`, value: s.index })
      })
    }
    sections.push({
      title: 'Caption',
      options: captionOptions,
      current: state.currentSubtitle,
      onChange: handleSubtitleChange,
    })

    const speedOptions = SPEEDS.map(s => ({
      label: `${s}x${s === 1 ? ' (Normal)' : ''}`,
      value: s,
    }))
    sections.push({
      title: 'Playback Speed',
      options: speedOptions,
      current: state.speed,
      onChange: handleSpeedChange,
    })

    return sections
  }, [state.qualities, state.subtitles, state.currentQuality, state.currentSubtitle, state.speed, handleQualityChange, handleSubtitleChange, handleSpeedChange])

  return (
    <>
      <div
        ref={containerRef}
        className={`w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl relative group cursor-pointer touch-manipulation ${state.theater ? 'rounded-none' : ''}`}
        style={state.theater ? { maxWidth: '100%', maxHeight: '85vh' } : {}}
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
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="w-20 h-20 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center transition-all hover:scale-110 shadow-2xl"
            >
              <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </motion.div>
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
        <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none">
          <div className="h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40 bg-[length:200%_100%] animate-gradient-x" />
        </div>
      )}

      {state.buffering && !state.playing && !state.hasPoster && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none bg-black/20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 border-[3px] border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-white/60 text-xs font-medium">Buffering...</p>
          </div>
        </div>
      )}

      {showSkipIntro && (
        <div className="absolute top-4 right-4 z-30">
          <button
            onClick={(e) => { e.stopPropagation(); skipIntro() }}
            className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all border border-white/10 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            Skip Intro
          </button>
        </div>
      )}

      <AnimatePresence>
        {showControls && (
          <ControlsBar
            state={state}
            st={st}
            progress={progress}
            videoRef={videoRef}
            togglePlay={togglePlay}
            seek={seek}
            toggleFullscreen={toggleFullscreen}
            togglePip={togglePip}
            toggleTheater={toggleTheater}
            handleShare={handleShare}
            onRetry={onRetry}
            handleVolumeChange={handleVolumeChange}
            handleSpeedChange={handleSpeedChange}
            handleQualityChange={handleQualityChange}
            handleAutoQualityToggle={handleAutoQualityToggle}
            handleSubtitleChange={handleSubtitleChange}
            settingsSections={settingsSections}
            animeTitle={animeTitle}
            episodeNumber={episodeNumber}
            currentLanguage={currentLanguage}
          />
        )}
      </AnimatePresence>

      {state.theater && (
        <button
          onClick={(e) => { e.stopPropagation(); toggleTheater() }}
          className="absolute top-3 right-3 z-40 bg-black/60 hover:bg-black/80 text-white/80 hover:text-white rounded-lg px-2 py-1 text-[10px] font-medium transition-all border border-white/10"
          aria-label="Exit theater mode"
        >
          Exit Theater
        </button>
      )}

      <KeyboardShortcutsModal
        show={state.showShortcuts}
        onClose={() => st({ showShortcuts: false })}
      />

      {swipeIndicator && (
        <div className={`absolute top-1/2 -translate-y-1/2 z-40 bg-black/60 backdrop-blur-sm rounded-full w-16 h-16 flex items-center justify-center shadow-2xl pointer-events-none ${
          Math.abs(swipeIndicator) > 20 ? 'top-1/3' : Math.abs(swipeIndicator) === 30 ? 'top-1/10' : ''
        } ${swipeIndicator > 0 ? 'left-4' : 'right-4'}`}>
          {Math.abs(swipeIndicator) === 30 ? (
            <svg className={`w-7 h-7 text-white ${swipeIndicator > 0 ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
            </svg>
          ) : (
            <svg className={`w-7 h-7 text-white ${swipeIndicator > 0 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
          )}
        </div>
      )}
      </div>
    </>
  )
}
