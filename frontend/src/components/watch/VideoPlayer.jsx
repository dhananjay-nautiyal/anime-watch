import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Hls from 'hls.js'
import ControlsBar from './ControlsBar'
import KeyboardShortcutsModal from './KeyboardShortcutsModal'
import { wrapProxy } from '../../hooks/useWatch'

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

function formatTime(sec) {
  if (!sec || !isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function VideoPlayer({
  embedUrl, poster, animeTitle, episodeNumber, animeId,
  onRetry, streamType = 'hls', onEnded, onTimeUpdate, autoNext = true, autoPlay = true,
  onSwipeUp, onSwipeDown,
  currentLanguage, onReady, onError, streamKey,
  externalSubtitles = [],
}) {
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const controlsTimer = useRef(null)
  const toastTimer = useRef(null)
  const hlsRef = useRef(null)
  const seeking = useRef(false)
  const readyFired = useRef(false)
  const lastSaveRef = useRef(0)
  const [resumeAt, setResumeAt] = useState(0)

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
    showShortcuts: false, toast: null,
  })
  // Accepts either a partial object or an updater, like React's setState.
  // Several controls pass `st(prev => ({ ... }))`; spreading a function used
  // to produce no keys, so those clicks silently did nothing.
  const st = useCallback((partial) => {
    setState(prev => {
      const patch = typeof partial === 'function' ? partial(prev) : partial
      return { ...prev, ...patch }
    })
  }, [])

  const notify = useCallback((message) => {
    st({ toast: message })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => st({ toast: null }), 2200)
  }, [st])

  const resetHideTimer = useCallback(() => {
    clearTimeout(controlsTimer.current)
    const v = videoRef.current
    if (!v || v.paused) return
    controlsTimer.current = setTimeout(() => {
      setState(prev => (prev.showSettings || prev.showVol ? prev : { ...prev, showControls: false }))
    }, CONTROLS_HIDE_DELAY)
  }, [])

  // Provider subtitles live outside the HLS manifest, so they are rendered as
  // native <track> elements and merged into the same Caption menu.
  const externalTracks = useMemo(() => (externalSubtitles || []).map((track, i) => ({
    index: 10000 + i,
    label: track.label || 'Subtitles',
    lang: track.language || 'und',
    url: wrapProxy(track.url, 'https://megaplay.buzz/'),
    external: true,
  })), [externalSubtitles])

  useEffect(() => {
    if (externalTracks.length === 0) return
    st({ subtitles: externalTracks, currentSubtitle: -1 })
    const v = videoRef.current
    if (v) for (const track of v.textTracks) track.mode = 'disabled'
  }, [externalTracks, st])

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
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else if (v) {
        if (!document.pictureInPictureEnabled) {
          notify('Picture-in-Picture is not available in this browser')
          return
        }
        await v.requestPictureInPicture()
      }
    } catch {
      notify('Picture-in-Picture is not available')
    }
  }, [notify])

  const toggleTheater = useCallback(() => {
    st(p => ({ theater: !p.theater }))
    localStorage.setItem(STORAGE.theater, String(!state.theater))
  }, [st, state.theater])

  const handleShare = useCallback(async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: animeTitle, url })
      } else {
        await navigator.clipboard.writeText(url)
        notify('Link copied to clipboard')
      }
    } catch (err) {
      // A cancelled share sheet is not an error worth surfacing.
      if (err?.name !== 'AbortError') notify('Could not copy the link')
    }
  }, [animeTitle, notify])

  const handleSubtitleChange = useCallback((idx) => {
    const v = videoRef.current
    const hls = hlsRef.current
    const selected = state.subtitles.find(t => t.index === idx)

    if (v) for (const track of v.textTracks) track.mode = 'disabled'

    if (selected?.external) {
      // Native <track> elements are matched by label; hls.js embedded tracks
      // are not touched here.
      if (hls) {
        hls.subtitleTrack = -1
        hls.subtitleDisplay = false
      }
      const native = v ? [...v.textTracks].find(t => t.label === selected.label) : null
      if (native) native.mode = 'showing'
    } else if (hls && hls.subtitleTrack !== undefined) {
      hls.subtitleTrack = idx
      hls.subtitleDisplay = idx >= 0
    }
    st({ currentSubtitle: idx })
  }, [st, state.subtitles])

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

  // Where the viewer left off in this exact episode, so the player can offer
  // to jump back in instead of always restarting at 00:00.
  const progressKey = useMemo(
    () => (animeId && episodeNumber ? `aw_progress_${animeId}_${episodeNumber}` : null),
    [animeId, episodeNumber]
  )

  useEffect(() => {
    readyFired.current = false
    setResumeAt(0)
    lastSaveRef.current = 0
  }, [embedUrl, streamKey, progressKey])

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
      if (progressKey && v.currentTime > 0) {
        const now = Date.now()
        if (now - lastSaveRef.current > 5000) {
          lastSaveRef.current = now
          try { localStorage.setItem(progressKey, String(Math.floor(v.currentTime))) } catch {}
        }
      }
    }
    const onMeta = () => {
      st({ duration: v.duration || 0 })
      if (!progressKey) return
      try {
        const saved = parseFloat(localStorage.getItem(progressKey) || '0')
        if (saved > 30 && v.duration && v.duration - saved > 20) setResumeAt(saved)
      } catch {}
    }
    const onW = () => st({ buffering: true })
    const onC = () => st({ buffering: false })
    const onE = () => {
      st({ playing: false })
      if (progressKey) { try { localStorage.removeItem(progressKey) } catch {} }
      if (autoNext && onEnded) onEnded()
    }
    v.addEventListener('play', onP)
    v.addEventListener('pause', onPa)
    v.addEventListener('timeupdate', onT)
    v.addEventListener('loadedmetadata', onMeta)
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
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('waiting', onW)
      v.removeEventListener('canplay', onC)
      v.removeEventListener('ended', onE)
    }
  }, [autoNext, onEnded, onTimeUpdate, st, onReady, onError, progressKey])

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
    clearTimeout(controlsTimer.current)
    if (state.playing && !state.showSettings && !state.showVol) {
      controlsTimer.current = setTimeout(() => {
        setState(prev => (prev.showSettings || prev.showVol ? prev : { ...prev, showControls: false }))
      }, CONTROLS_HIDE_DELAY)
    }
    return () => clearTimeout(controlsTimer.current)
  }, [state.playing, state.showSettings, state.showVol])

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

    // A dead CDN otherwise leaves the player spinning forever. Give a slow
    // first segment one recovery attempt before surfacing an error, so a
    // momentary CDN hiccup doesn't show "stream unavailable".
    let stallTimer
    let stallRetried = false
    const checkStall = () => {
      if (v.readyState >= 2) return
      if (!stallRetried && hlsRef.current) {
        stallRetried = true
        hlsRef.current.startLoad()
        stallTimer = setTimeout(checkStall, 20000)
        return
      }
      st({ buffering: false })
      onError?.('Stream is not responding. Try another server.')
    }
    stallTimer = setTimeout(checkStall, 30000)
    const clearStall = () => clearTimeout(stallTimer)
    v.addEventListener('loadeddata', clearStall)
    v.addEventListener('canplay', clearStall)

    if (streamType === 'hls' && Hls.isSupported() && embedUrl.includes('.m3u8')) {
      const hlsUrl = wrapProxy(embedUrl, 'https://anineko.to/')
      const hls = new Hls({
        enableWorker: true,
        // VOD playlists gain nothing from low-latency mode; it only makes the
        // player re-request playlists more often.
        lowLatencyMode: false,
        startFragPrefetch: true,
        capLevelToPlayerSize: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        backBufferLength: 30,
        abrEwmaDefaultEstimate: 1500000,
      })
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
        // An empty event would otherwise wipe the provider's external tracks.
        if (subtitleTracks.length === 0) return
        st({ subtitles: subtitleTracks.map((t, i) => ({ index: i, label: t.label, lang: t.lang })) })
      })
      let networkRetries = 0
      let mediaRetries = 0
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return
        // Recover from transient segment/CDN failures before giving up.
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < 2) {
          networkRetries++
          hls.startLoad()
          return
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries < 1) {
          mediaRetries++
          hls.recoverMediaError()
          return
        }
        st({ buffering: false })
        onError?.(`HLS error: ${data.type} - ${data.details}`)
        hls.destroy()
        hlsRef.current = null
      })
    } else {
      const directSrc = wrapProxy(embedUrl)
      v.src = directSrc
      if (autoPlay) v.play().catch(() => {})
    }

    return () => {
      clearTimeout(stallTimer)
      v.removeEventListener('loadeddata', clearStall)
      v.removeEventListener('canplay', clearStall)
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
    const availableHeights = new Set()
    if (state.qualities.length > 0) {
      state.qualities.forEach(q => {
        qualityOptions.push({ label: q.label, value: q.index })
        if (q.height) availableHeights.add(q.height)
      })
    }
    // Keep the familiar tier list even when the provider only encodes one
    // rendition: unavailable tiers are disabled rather than silently absent.
    ;[1080, 720, 480, 360].forEach(height => {
      if (availableHeights.has(height)) return
      qualityOptions.push({
        label: `${height}p`,
        value: `unavailable-${height}`,
        disabled: true,
      })
    })
    sections.push({
      title: 'Video Quality',
      options: qualityOptions,
      current: state.currentQuality,
      onChange: handleQualityChange,
    })

    const captionOptions = [{ label: 'Off', value: -1 }]
    if (state.subtitles.length > 0) {
      state.subtitles.forEach(s => {
        const label = state.subtitles.length === 1 && s.external ? `On (${s.label})` : s.label
        captionOptions.push({ label, value: s.index })
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
      onMouseMove={() => { st({ showControls: true }); resetHideTimer() }}
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
      >
        {externalTracks.map(track => (
          <track
            key={track.url}
            kind="subtitles"
            src={track.url}
            srcLang={track.lang}
            label={track.label}
          />
        ))}
      </video>

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

      {resumeAt > 0 && (
        <div className="absolute bottom-24 left-4 z-40 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              const v = videoRef.current
              if (v) v.currentTime = Math.min(v.duration || resumeAt, resumeAt)
              setResumeAt(0)
            }}
            className="glass text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all hover:bg-white/[0.12]"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            Resume from {formatTime(resumeAt)}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setResumeAt(0) }}
            className="text-white/60 hover:text-white text-xs font-medium px-2.5 py-1.5 rounded-lg bg-black/40 backdrop-blur-xl border border-white/10 transition-all"
          >
            Start over
          </button>
        </div>
      )}

      {showSkipIntro && (
        <div className="absolute top-4 right-4 z-40">
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
      {state.toast && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 bg-black/85 backdrop-blur-sm text-white text-xs font-medium px-4 py-2 rounded-lg shadow-2xl pointer-events-none">
          {state.toast}
        </div>
      )}
      </div>
    </>
  )
}
