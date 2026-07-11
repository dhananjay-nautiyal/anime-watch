import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Hls from 'hls.js'
import client from '../api/client'

const RECOVERY_ATTEMPTS = 3
const SERVER_TIMEOUT_MS = 15000
const CONTROLS_HIDE_DELAY = 3000
const SKIP_INTRO_START = 85
const SKIP_INTRO_WINDOW = 15
const COUNTDOWN_SECONDS = 5
const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]

const STORAGE_KEYS = {
  volume: 'animewatch_volume',
  speed: 'animewatch_playbackSpeed',
  resume: (aid, ep) => `animewatch_resume_${aid}_${ep}`,
}

function formatTime(seconds) {
  if (!seconds || !isFinite(seconds)) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function log(...args) {
  if (typeof console !== 'undefined') console.log('[VideoPlayer]', ...args)
}

function toProxyUrl(url, referer = 'https://anineko.to/') {
  if (!url) return url
  if (url.startsWith('/api/stream/proxy')) return url
  return `/api/stream/proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`
}

const VideoPlayer = memo(function VideoPlayer({
  embedUrl,
  servers = [],
  poster,
  animeTitle,
  episodeNumber,
  animeId,
  onRetry,
  onChangeSource,
  streamType,
  onEnded,
  autoNext,
  autoPlay,
}) {
  const [userClicked, setUserClicked] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(1)
  const [muted, setMuted] = useState(false)
  const [playbackSpeed, setPlaybackSpeedState] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPiP, setIsPiP] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeServerIndex, setActiveServerIndex] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [qualityLevels, setQualityLevels] = useState([])
  const [currentQuality, setCurrentQuality] = useState(-1)
  const [showResumeDialog, setShowResumeDialog] = useState(false)
  const [resumeTime, setResumeTime] = useState(0)
  const [autoNextCountdown, setAutoNextCountdown] = useState(0)
  const [showSkipIntro, setShowSkipIntro] = useState(false)
  const [showSkipOutro, setShowSkipOutro] = useState(false)
  const [switchingServer, setSwitchingServer] = useState(false)
  const [allProvidersFailed, setAllProvidersFailed] = useState(false)
  const [freshUrl, setFreshUrl] = useState('')

  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const containerRef = useRef(null)
  const progressRef = useRef(null)
  const settingsRef = useRef(null)
  const controlsTimer = useRef(null)
  const hlsRecoveryRef = useRef(0)
  const timeoutRef = useRef(null)
  const countdownRef = useRef(null)
  const lastVolumeRef = useRef(1)
  const freshMappingAttemptedRef = useRef(false)
  const allProvidersFailedRef = useRef(false)

  const serverUrls = useMemo(() => {
    const urls = []
    if (freshUrl) urls.push(freshUrl)
    if (embedUrl) urls.push(toProxyUrl(embedUrl))
    if (servers && servers.length > 0) {
      servers.forEach(s => {
        if (s.url && !urls.includes(s.url)) urls.push(toProxyUrl(s.url))
      })
    }
    return urls
  }, [embedUrl, servers, freshUrl])

  const currentUrl = useMemo(
    () => serverUrls[activeServerIndex] || toProxyUrl(embedUrl),
    [serverUrls, activeServerIndex, embedUrl]
  )

  const originalEpisodeUrl = useMemo(() => {
    if (!embedUrl) return ''
    try {
      if (embedUrl.startsWith('/api/stream/proxy')) {
        const qs = embedUrl.includes('?') ? embedUrl.split('?')[1] : ''
        const params = new URLSearchParams(qs)
        const original = params.get('url')
        if (original) return decodeURIComponent(original)
      }
    } catch {}
    return embedUrl
  }, [embedUrl])

  const resolvedType = useMemo(() => {
    if (streamType === 'hls' || (currentUrl && currentUrl.includes('.m3u8'))) return 'hls'
    if (streamType === 'iframe') return 'iframe'
    if (currentUrl) return 'video'
    return null
  }, [streamType, currentUrl])

  const isTouchDevice = useMemo(
    () => typeof window !== 'undefined' && 'ontouchstart' in window,
    []
  )

  const pipSupported = useMemo(
    () => typeof document !== 'undefined' && 'pictureInPictureEnabled' in document,
    []
  )

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const resetControlsTimer = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current)
    setShowControls(true)
    setShowSettings(false)
    if (!isTouchDevice && playing) {
      controlsTimer.current = setTimeout(() => {
        setShowControls(false)
      }, CONTROLS_HIDE_DELAY)
    }
  }, [playing, isTouchDevice])

  const requestFreshMapping = useCallback(async () => {
    if (!animeId || !originalEpisodeUrl) return null
    try {
      const response = await client.get(`/api/anime/${animeId}/episode/embed`, {
        params: { episodeUrl: originalEpisodeUrl }
      })
      const data = response.data?.data
      if (data?.embedUrl) {
        return toProxyUrl(data.embedUrl, 'https://anineko.to/')
      }
    } catch (e) {
      log('Failed to get fresh mapping:', e)
    }
    return null
  }, [animeId, originalEpisodeUrl])

  const handleAllServersFailed = useCallback(async () => {
    if (allProvidersFailedRef.current) return
    if (freshMappingAttemptedRef.current) return

    freshMappingAttemptedRef.current = true

    const newUrl = await requestFreshMapping()

    if (newUrl && newUrl !== freshUrl) {
      log('Fresh mapping obtained, retrying with:', newUrl)
      setFreshUrl(newUrl)
      setActiveServerIndex(0)
      setError(false)
      setErrorMessage('')
      setLoading(true)
      setShowResumeDialog(false)
      setShowSkipIntro(false)
      setShowSkipOutro(false)
      hlsRecoveryRef.current = 0
      clearTimer()
    } else {
      log('All providers failed')
      setAllProvidersFailed(true)
      allProvidersFailedRef.current = true
      setLoading(false)
      setError(false)
      setErrorMessage('')
    }
  }, [requestFreshMapping, freshUrl, clearTimer])

  const tryNextServer = useCallback(() => {
    const nextIdx = activeServerIndex + 1
    if (nextIdx < serverUrls.length) {
      log(`Switching to server ${nextIdx + 1}/${serverUrls.length}`)
      setActiveServerIndex(nextIdx)
      setError(false)
      setErrorMessage('')
      setLoading(true)
      setShowResumeDialog(false)
      setSwitchingServer(true)
      setShowSkipIntro(false)
      setShowSkipOutro(false)
      hlsRecoveryRef.current = 0
      clearTimer()
      setTimeout(() => setSwitchingServer(false), 2000)
      return true
    }
    return false
  }, [activeServerIndex, serverUrls.length, clearTimer])

  const handleVideoEnded = useCallback(() => {
    setPlaying(false)
    if (autoNext) {
      setAutoNextCountdown(COUNTDOWN_SECONDS)
    } else if (onEnded) {
      onEnded()
    }
  }, [autoNext, onEnded])

  useEffect(() => {
    try {
      const savedVolume = parseFloat(localStorage.getItem(STORAGE_KEYS.volume))
      if (!isNaN(savedVolume) && savedVolume >= 0 && savedVolume <= 1) {
        setVolumeState(savedVolume)
        lastVolumeRef.current = savedVolume
      }
    } catch {}
    try {
      const savedSpeed = parseFloat(localStorage.getItem(STORAGE_KEYS.speed))
      if (PLAYBACK_SPEEDS.includes(savedSpeed)) setPlaybackSpeedState(savedSpeed)
    } catch {}
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(false)
    setErrorMessage('')
    setActiveServerIndex(0)
    setSwitchingServer(false)
    setAutoNextCountdown(0)
    setShowSkipIntro(false)
    setShowSkipOutro(false)
    setShowResumeDialog(false)
    setShowSettings(false)
    setQualityLevels([])
    setCurrentQuality(-1)
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setBuffering(false)
    setAllProvidersFailed(false)
    setFreshUrl('')
    hlsRecoveryRef.current = 0
    allProvidersFailedRef.current = false
    freshMappingAttemptedRef.current = false
    clearTimer()
  }, [embedUrl])

  useEffect(() => {
    if (!userClicked || !currentUrl || !videoRef.current || resolvedType === 'iframe') return
    const video = videoRef.current

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      if (video.duration && isFinite(video.duration)) setDuration(video.duration)
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onWaiting = () => setBuffering(true)
    const onCanPlay = () => setBuffering(false)
    const onPlaying = () => setBuffering(false)
    const onSeeked = () => setBuffering(false)
    const onVolumeChange = () => {
      setMuted(video.muted)
      setVolumeState(video.volume)
    }
    const onRateChange = () => {
      setPlaybackSpeedState(video.playbackRate)
    }
    const onEndedWrapper = () => handleVideoEnded()
    const onLoadedMetadata = () => {
      if (video.duration && isFinite(video.duration)) setDuration(video.duration)
    }

    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('canplay', onCanPlay)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('volumechange', onVolumeChange)
    video.addEventListener('ratechange', onRateChange)
    video.addEventListener('ended', onEndedWrapper)
    video.addEventListener('loadedmetadata', onLoadedMetadata)

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('canplay', onCanPlay)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('volumechange', onVolumeChange)
      video.removeEventListener('ratechange', onRateChange)
      video.removeEventListener('ended', onEndedWrapper)
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
    }
  }, [userClicked, currentUrl, resolvedType, handleVideoEnded])

  useEffect(() => {
    if (resolvedType !== 'hls' || !userClicked || !currentUrl || !videoRef.current) {
      if (resolvedType === 'video' && userClicked && currentUrl && videoRef.current) {
        const video = videoRef.current
        video.src = currentUrl
        video.volume = muted ? 0 : volume
        video.playbackRate = playbackSpeed
        if (autoPlay !== false) video.play().catch(() => {})
      }
      return
    }

    const video = videoRef.current
    video.volume = muted ? 0 : volume
    video.playbackRate = playbackSpeed

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    clearTimer()
    timeoutRef.current = setTimeout(() => {
      if (loading) {
        log('HLS load timeout')
        if (!tryNextServer()) {
          handleAllServersFailed()
        }
      }
    }, SERVER_TIMEOUT_MS)

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: false,
        withCredentials: false,
        xhrSetup: (xhr) => {
          xhr.withCredentials = false
        },
      })
      hlsRef.current = hls
      hls.loadSource(currentUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        clearTimer()
        setLoading(false)
        setBuffering(false)
        hlsRecoveryRef.current = 0
        if (hls.levels && hls.levels.length > 0) {
          setQualityLevels(hls.levels.map((l, i) => ({
            index: i,
            height: l.height || 0,
            bitrate: l.bitrate || 0,
            label: l.height ? `${l.height}p` : `Quality ${i + 1}`,
          })))
        }
        if (autoPlay !== false) video.play().catch(() => {})
      })

      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        setCurrentQuality(data.level)
      })

      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          log(`HLS fatal error: type=${data.type} detail=${data.detail}`)
          hlsRecoveryRef.current++
          if (hlsRecoveryRef.current <= RECOVERY_ATTEMPTS) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad()
            } else if (hls.levels && hls.levels.length > 0) {
              const nextLevel = Math.max(0, (hls.currentLevel || 0) - 1)
              hls.currentLevel = nextLevel
            } else {
              hls.recoverMediaError()
            }
          } else if (tryNextServer()) {
          } else {
            handleAllServersFailed()
          }
        }
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = currentUrl
      video.addEventListener('loadedmetadata', () => {
        clearTimer()
        setLoading(false)
        setBuffering(false)
        hlsRecoveryRef.current = 0
        if (autoPlay !== false) video.play().catch(() => {})
      }, { once: true })
      video.addEventListener('error', () => {
        if (hlsRecoveryRef.current < RECOVERY_ATTEMPTS) {
          hlsRecoveryRef.current++
          setTimeout(() => { video.load(); video.play().catch(() => {}) }, 1000)
        } else if (!tryNextServer()) {
          handleAllServersFailed()
        }
      })
    } else {
      setError(true)
      setErrorMessage('HLS is not supported in this browser')
      setLoading(false)
    }

    return () => {
      clearTimer()
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [userClicked, currentUrl, resolvedType, autoPlay, loading, clearTimer, tryNextServer, volume, muted, playbackSpeed, handleAllServersFailed])

  useEffect(() => {
    if (resolvedType !== 'iframe' || !userClicked || !currentUrl) return
    clearTimer()
    timeoutRef.current = setTimeout(() => {
      if (loading) {
        log('Iframe load timeout')
        if (!tryNextServer()) {
          handleAllServersFailed()
        }
      }
    }, SERVER_TIMEOUT_MS)
    return () => clearTimer()
  }, [userClicked, resolvedType, currentUrl, loading, clearTimer, tryNextServer, handleAllServersFailed])

  useEffect(() => {
    if (!playing || !duration) return
    const introVisible = currentTime >= SKIP_INTRO_START && currentTime < SKIP_INTRO_START + SKIP_INTRO_WINDOW
    const outroVisible = duration > 120 && currentTime >= duration - 60
    setShowSkipIntro(introVisible)
    setShowSkipOutro(outroVisible)
  }, [currentTime, duration, playing])

  useEffect(() => {
    if (autoNextCountdown <= 0) return
    countdownRef.current = setInterval(() => {
      setAutoNextCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current)
          if (onEnded) onEnded()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [autoNextCountdown, onEnded])

  useEffect(() => {
    if (!userClicked || resolvedType === 'iframe' || !currentUrl) return
    const saveInterval = setInterval(() => {
      const video = videoRef.current
      if (video && playing && video.currentTime > 5) {
        try {
          localStorage.setItem(`animewatch_resume_${animeId}_${episodeNumber}`, String(video.currentTime))
        } catch {}
      }
    }, 5000)
    return () => clearInterval(saveInterval)
  }, [userClicked, resolvedType, currentUrl, playing, animeId, episodeNumber])

  useEffect(() => {
    if (!userClicked || resolvedType === 'iframe' || !currentUrl) return
    try {
      const saved = localStorage.getItem(`animewatch_resume_${animeId}_${episodeNumber}`)
      if (saved) {
        const t = parseFloat(saved)
        if (!isNaN(t) && t > 5) {
          setResumeTime(t)
          setShowResumeDialog(true)
        }
      }
    } catch {}
  }, [userClicked, resolvedType, currentUrl, animeId, episodeNumber])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!userClicked) return
      const video = videoRef.current
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          togglePlay()
          break
        case 'f':
          e.preventDefault()
          toggleFullscreen()
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (video) {
            video.currentTime = Math.max(0, video.currentTime - 10)
            setCurrentTime(video.currentTime)
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          if (video) {
            video.currentTime = Math.min(duration, video.currentTime + 10)
            setCurrentTime(video.currentTime)
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          if (video) {
            const newVol = Math.min(1, (video.volume || 0) + 0.1)
            video.volume = newVol
            video.muted = false
            setVolumeState(newVol)
            setMuted(false)
            localStorage.setItem(STORAGE_KEYS.volume, String(newVol))
          }
          break
        case 'ArrowDown':
          e.preventDefault()
          if (video) {
            const newVol = Math.max(0, (video.volume || 0) - 0.1)
            video.volume = newVol
            video.muted = newVol === 0
            setVolumeState(newVol)
            setMuted(newVol === 0)
            localStorage.setItem(STORAGE_KEYS.volume, String(newVol))
          }
          break
        case 'm':
          e.preventDefault()
          toggleMute()
          break
        case 'Escape':
          if (showSettings) setShowSettings(false)
          else if (document.fullscreenElement) document.exitFullscreen()
          break
        case 'p':
          e.preventDefault()
          togglePiP()
          break
        case 'n':
          e.preventDefault()
          if (onEnded) onEnded()
          break
        case '>':
        case '.':
          e.preventDefault()
          if (video) {
            const speeds = PLAYBACK_SPEEDS
            const idx = speeds.indexOf(video.playbackRate)
            if (idx < speeds.length - 1) {
              video.playbackRate = speeds[idx + 1]
              setPlaybackSpeedState(speeds[idx + 1])
              localStorage.setItem(STORAGE_KEYS.speed, String(speeds[idx + 1]))
            }
          }
          break
        case '<':
        case ',':
          e.preventDefault()
          if (video) {
            const speeds = PLAYBACK_SPEEDS
            const idx = speeds.indexOf(video.playbackRate)
            if (idx > 0) {
              video.playbackRate = speeds[idx - 1]
              setPlaybackSpeedState(speeds[idx - 1])
              localStorage.setItem(STORAGE_KEYS.speed, String(speeds[idx - 1]))
            }
          }
          break
        default:
          if (e.key >= '0' && e.key <= '9' && video) {
            e.preventDefault()
            const pct = parseInt(e.key) / 10
            video.currentTime = pct * (video.duration || 0)
            setCurrentTime(video.currentTime)
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [userClicked, duration, showSettings, onEnded])

  useEffect(() => {
    const handleClick = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setShowSettings(false)
      }
    }
    if (showSettings) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [showSettings])

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  useEffect(() => {
    const handlePiPChange = () => {
      setIsPiP(!!document.pictureInPictureElement)
    }
    if (pipSupported) {
      document.addEventListener('enterpictureinpicture', handlePiPChange)
      document.addEventListener('leavepictureinpicture', handlePiPChange)
      return () => {
        document.removeEventListener('enterpictureinpicture', handlePiPChange)
        document.removeEventListener('leavepictureinpicture', handlePiPChange)
      }
    }
  }, [pipSupported])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play().catch(() => {})
    } else {
      video.pause()
    }
    resetControlsTimer()
  }, [resetControlsTimer])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.muted) {
      video.muted = false
      video.volume = lastVolumeRef.current || 1
      setMuted(false)
      setVolumeState(lastVolumeRef.current || 1)
    } else {
      lastVolumeRef.current = video.volume
      video.muted = true
      setMuted(true)
    }
    resetControlsTimer()
  }, [resetControlsTimer])

  const handleVolumeChange = useCallback((e) => {
    const val = parseFloat(e.target.value)
    const video = videoRef.current
    if (!video) return
    video.volume = val
    video.muted = val === 0
    setVolumeState(val)
    setMuted(val === 0)
    lastVolumeRef.current = val > 0 ? val : lastVolumeRef.current
    localStorage.setItem(STORAGE_KEYS.volume, String(val))
    resetControlsTimer()
  }, [resetControlsTimer])

  const handleSeek = useCallback((e) => {
    const video = videoRef.current
    const bar = progressRef.current
    if (!video || !bar) return
    const rect = bar.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const seekTime = x * (video.duration || 0)
    video.currentTime = seekTime
    setCurrentTime(seekTime)
    resetControlsTimer()
  }, [resetControlsTimer])

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      el.requestFullscreen().catch(() => {})
    }
  }, [])

  const togglePiP = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else {
        await video.requestPictureInPicture()
      }
    } catch {}
  }, [])

  const handleSpeedChange = useCallback((speed) => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = speed
    setPlaybackSpeedState(speed)
    setShowSettings(false)
    localStorage.setItem(STORAGE_KEYS.speed, String(speed))
  }, [])

  const handleQualityChange = useCallback((index) => {
    const hls = hlsRef.current
    if (!hls) return
    hls.currentLevel = index
    setCurrentQuality(index)
    setShowSettings(false)
  }, [])

  const handleServerSelect = useCallback((index) => {
    if (index === activeServerIndex) return
    setActiveServerIndex(index)
    setError(false)
    setErrorMessage('')
    setLoading(true)
    setSwitchingServer(true)
    hlsRecoveryRef.current = 0
    clearTimer()
    setShowSettings(false)
    setTimeout(() => setSwitchingServer(false), 2000)
  }, [activeServerIndex, clearTimer])

  const handleSkipIntro = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const skipTo = SKIP_INTRO_START + SKIP_INTRO_WINDOW + 5
    video.currentTime = skipTo
    setCurrentTime(skipTo)
    setShowSkipIntro(false)
  }, [])

  const handleSkipOutro = useCallback(() => {
    const video = videoRef.current
    if (!video || !onEnded) return
    video.currentTime = video.duration
    onEnded()
  }, [onEnded])

  const handleCancelAutoNext = useCallback(() => {
    setAutoNextCountdown(0)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }, [])

  const handleResume = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = resumeTime
    setCurrentTime(resumeTime)
    setShowResumeDialog(false)
  }, [resumeTime])

  const handleResumeCancel = useCallback(() => {
    setShowResumeDialog(false)
    try {
      localStorage.removeItem(`animewatch_resume_${animeId}_${episodeNumber}`)
    } catch {}
  }, [animeId, episodeNumber])

  const handleIframeLoad = useCallback(() => {
    clearTimer()
    setLoading(false)
  }, [clearTimer])

  const handleIframeError = useCallback(() => {
    clearTimer()
    log('Iframe onError')
    if (!tryNextServer()) {
      handleAllServersFailed()
    }
  }, [clearTimer, tryNextServer, handleAllServersFailed])

  const handleRetry = useCallback(() => {
    setActiveServerIndex(0)
    setError(false)
    setErrorMessage('')
    setLoading(true)
    setAllProvidersFailed(false)
    setFreshUrl('')
    hlsRecoveryRef.current = 0
    allProvidersFailedRef.current = false
    freshMappingAttemptedRef.current = false
    clearTimer()
    if (onRetry) onRetry()
  }, [clearTimer, onRetry])

  const handleCheckProviderStatus = useCallback(async () => {
    try {
      const res = await client.get('/api/stream/health')
      if (res.data?.data?.proxyEnabled) {
        log('Stream proxy is healthy')
      }
    } catch (e) {
      log('Health check failed:', e)
    }
  }, [])

  const handleRetryAll = useCallback(() => {
    handleRetry()
  }, [handleRetry])

  const handleWatch = useCallback(() => {
    setUserClicked(true)
    setLoading(true)
    setError(false)
    setErrorMessage('')
  }, [])

  const handleMouseMove = useCallback(() => {
    if (!showControls) setShowControls(true)
    if (controlsTimer.current) clearTimeout(controlsTimer.current)
    if (playing && !isTouchDevice) {
      controlsTimer.current = setTimeout(() => {
        if (!showSettings) setShowControls(false)
      }, CONTROLS_HIDE_DELAY)
    }
  }, [playing, showControls, showSettings, isTouchDevice])

  const handleMouseLeave = useCallback(() => {
    if (playing && !isTouchDevice && !showSettings) {
      setShowControls(false)
    }
  }, [playing, isTouchDevice, showSettings])

  const handleContainerClick = useCallback((e) => {
    if (e.target === containerRef.current || e.target.closest('video')) {
      togglePlay()
      resetControlsTimer()
    }
  }, [togglePlay, resetControlsTimer])

  const bufferedPercent = useMemo(() => {
    const video = videoRef.current
    if (!video || !video.buffered || video.buffered.length === 0 || !duration) return 0
    return (video.buffered.end(video.buffered.length - 1) / duration) * 100
  }, [currentTime, duration])

  const progressPercent = useMemo(() => {
    if (!duration) return 0
    return (currentTime / duration) * 100
  }, [currentTime, duration])

  const showPoster = !userClicked && !error && !allProvidersFailed
  const isMediaType = resolvedType === 'hls' || resolvedType === 'video'
  const streamHasControls = isMediaType && userClicked && !error && !allProvidersFailed

  const serverLabel = useMemo(() => {
    const s = servers[activeServerIndex]
    return s?.label || `Server ${activeServerIndex + 1}`
  }, [servers, activeServerIndex])

  if (allProvidersFailed) {
    return (
      <div className="relative w-full aspect-video bg-[#050816] rounded-xl overflow-hidden flex items-center justify-center shadow-2xl shadow-primary/5">
        <div className="flex flex-col items-center gap-5 px-6 text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white text-base font-bold mb-1">Temporarily Unavailable</h3>
            <p className="text-muted text-xs leading-relaxed">
              This anime is currently unavailable on all streaming providers. Please try again later.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <button
              onClick={handleRetryAll}
              className="bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-lg text-sm font-medium transition-all"
            >
              Retry
            </button>
            <button
              onClick={handleCheckProviderStatus}
              className="bg-white/10 hover:bg-white/20 text-link px-5 py-2 rounded-lg text-sm font-medium transition-all"
            >
              Check Provider Status
            </button>
            <a
              href="/browse"
              className="text-muted hover:text-white text-xs font-medium transition-colors"
            >
              Browse other anime
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (error && !currentUrl) {
    return (
      <div className="relative w-full aspect-video bg-[#050816] rounded-xl overflow-hidden flex items-center justify-center shadow-2xl shadow-primary/5">
        <div className="flex flex-col items-center gap-4 px-6 text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-white text-sm font-medium mb-1">Stream source unavailable</p>
            <p className="text-muted text-xs">{errorMessage || 'No embed URL could be retrieved'}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <button onClick={handleRetry} className="bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-lg text-sm font-medium transition-all">Retry</button>
            {onChangeSource && <button onClick={onChangeSource} className="bg-white/10 hover:bg-white/20 text-link px-5 py-2 rounded-lg text-sm font-medium transition-all">Change Source</button>}
          </div>
        </div>
      </div>
    )
  }

  if (error && currentUrl) {
    return (
      <div className="relative w-full aspect-video bg-[#050816] rounded-xl overflow-hidden flex items-center justify-center shadow-2xl shadow-primary/5">
        <div className="flex flex-col items-center gap-4 px-6 text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-white text-sm font-medium mb-1">Could not load player</p>
            <p className="text-muted text-xs">{errorMessage || 'The stream may have been blocked or refused to load'}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <button onClick={handleRetry} className="bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-lg text-sm font-medium transition-all">Retry</button>
            {serverUrls.length > 1 && activeServerIndex < serverUrls.length - 1 && (
              <button onClick={tryNextServer} className="bg-white/10 hover:bg-white/20 text-link px-5 py-2 rounded-lg text-sm font-medium transition-all">
                Switch Server ({activeServerIndex + 2}/{serverUrls.length})
              </button>
            )}
            {onChangeSource && <button onClick={onChangeSource} className="bg-white/10 hover:bg-white/20 text-link px-5 py-2 rounded-lg text-sm font-medium transition-all">Change Source</button>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button className="text-muted hover:text-white text-xs transition-colors">Report broken stream</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-[#050816] rounded-xl overflow-hidden shadow-2xl shadow-primary/5 group select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleContainerClick}
    >
      <AnimatePresence>
        {showPoster && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer"
            onClick={handleWatch}
          >
            {poster && (
              <>
                <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" loading="lazy" decoding="async" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-black/40 to-[#050816]/60" />
              </>
            )}
            <div className="relative z-10 flex flex-col items-center gap-4">
              {animeTitle && <p className="text-white text-sm font-medium text-center max-w-xs truncate px-4">{animeTitle}</p>}
              {episodeNumber && <p className="text-primary text-xs font-bold">Episode {episodeNumber}</p>}
              <button
                onClick={(e) => { e.stopPropagation(); handleWatch() }}
                className="w-16 h-16 rounded-full bg-primary/90 hover:bg-primary shadow-lg shadow-primary/30 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
              >
                <svg className="w-7 h-7 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              </button>
              <span className="text-white text-xs font-medium">Watch</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {userClicked && loading && !error && !switchingServer && !allProvidersFailed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-[#050816] z-10 p-6"
          >
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
            <p className="text-muted text-xs">Loading player...</p>
            {serverUrls.length > 1 && (
              <p className="text-muted/60 text-[10px] mt-1">{serverLabel}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {switchingServer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-[#050816]/90 z-10 p-6"
          >
            <div className="w-8 h-8 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin mb-3" />
            <p className="text-yellow-400 text-xs font-medium">Switching server...</p>
            <p className="text-muted/60 text-[10px] mt-1">{serverLabel}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResumeDialog && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 bg-surface/95 backdrop-blur-xl border border-white/10 rounded-xl px-5 py-3 shadow-xl"
          >
            <p className="text-white text-xs font-medium mb-2">Resume from {formatTime(resumeTime)}?</p>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); handleResume() }} className="bg-primary hover:bg-primary/90 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-all">Resume</button>
              <button onClick={(e) => { e.stopPropagation(); handleResumeCancel() }} className="bg-white/10 hover:bg-white/20 text-muted text-xs font-medium px-4 py-1.5 rounded-lg transition-all">Start Over</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {userClicked && currentUrl && resolvedType === 'hls' && (
        <video
          ref={videoRef}
          key={`${currentUrl}-${activeServerIndex}`}
          className="w-full h-full object-contain"
          poster={poster}
          playsInline
          preload="metadata"
        />
      )}

      {userClicked && currentUrl && resolvedType === 'video' && (
        <video
          ref={videoRef}
          key={`${currentUrl}-${activeServerIndex}`}
          className="w-full h-full object-contain"
          poster={poster}
          playsInline
          preload="metadata"
        />
      )}

      {userClicked && currentUrl && resolvedType === 'iframe' && (
        <iframe
          key={`${currentUrl}-${activeServerIndex}`}
          src={currentUrl}
          className="w-full h-full"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture"
          title="Video player"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          style={{ border: 'none' }}
        />
      )}

      {userClicked && !currentUrl && !error && !allProvidersFailed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050816] p-6 z-10">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
          <p className="text-muted text-xs">Fetching stream source...</p>
          <button onClick={handleRetry} className="mt-4 bg-primary/20 hover:bg-primary/30 text-primary text-xs px-4 py-1.5 rounded-lg transition-colors font-medium">Retry</button>
        </div>
      )}

      <AnimatePresence>
        {streamHasControls && buffering && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
          >
            <div className="w-10 h-10 border-[3px] border-white/20 border-t-white rounded-full animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {autoNextCountdown > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#050816]/80 backdrop-blur-sm"
          >
            <p className="text-white text-lg font-bold mb-1">Next episode</p>
            <p className="text-muted text-sm mb-4">Starting in {autoNextCountdown}</p>
            <button
              onClick={(e) => { e.stopPropagation(); handleCancelAutoNext() }}
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-5 py-2 rounded-lg transition-all"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {streamHasControls && showSkipIntro && !autoNextCountdown && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute bottom-20 right-4 z-20"
          >
            <button
              onClick={(e) => { e.stopPropagation(); handleSkipIntro() }}
              className="bg-primary/90 hover:bg-primary text-white text-xs font-medium px-4 py-2 rounded-lg shadow-lg transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
              Skip Intro
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {streamHasControls && showSkipOutro && !autoNextCountdown && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute bottom-20 right-4 z-20"
          >
            <button
              onClick={(e) => { e.stopPropagation(); handleSkipOutro() }}
              className="bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-4 py-2 rounded-lg shadow-lg transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
              Skip Outro
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {streamHasControls && (showControls || !playing) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-20 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"
          >
            <div className="pointer-events-auto px-3 pb-2 pt-10" onClick={(e) => e.stopPropagation()}>
              <div
                ref={progressRef}
                className="relative w-full h-1.5 bg-white/20 rounded-full cursor-pointer group/progress mb-3 hover:h-2.5 transition-all duration-150"
                onClick={handleSeek}
              >
                <div
                  className="absolute top-0 left-0 h-full bg-white/30 rounded-full transition-all"
                  style={{ width: `${bufferedPercent}%` }}
                />
                <div
                  className="absolute top-0 left-0 h-full bg-primary rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-primary rounded-full shadow-md opacity-0 group-hover/progress:opacity-100 transition-opacity"
                  style={{ left: `calc(${progressPercent}% - 7px)` }}
                />
              </div>

              <div className="flex items-center gap-2">
                <button onClick={togglePlay} className="text-white hover:text-primary transition-colors p-1" title={playing ? 'Pause (Space)' : 'Play (Space)'}>
                  {playing ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                <button onClick={() => { const v = videoRef.current; if (v) { v.currentTime = Math.max(0, v.currentTime - 10); resetControlsTimer() } }} className="text-white/70 hover:text-white transition-colors p-1" title="Rewind 10s">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                  </svg>
                </button>

                <button onClick={() => { const v = videoRef.current; if (v) { v.currentTime = Math.min(v.duration || 0, v.currentTime + 10); resetControlsTimer() } }} className="text-white/70 hover:text-white transition-colors p-1" title="Forward 10s">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                  </svg>
                </button>

                <span className="text-white/80 text-[11px] font-medium tabular-nums whitespace-nowrap min-w-[90px]">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>

                <div className="flex-1" />

                <div className="flex items-center gap-1.5 group/vol">
                  <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors p-1" title={muted ? 'Unmute (M)' : 'Mute (M)'}>
                    {muted || volume === 0 ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                    )}
                  </button>
                  <div className="w-0 group-hover/vol:w-20 overflow-hidden transition-all duration-200">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={muted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-full h-1 appearance-none bg-white/20 rounded-full cursor-pointer accent-primary
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md"
                    />
                  </div>
                </div>

                <div className="relative" ref={settingsRef}>
                  <button
                    onClick={() => setShowSettings(prev => !prev)}
                    className="text-white/70 hover:text-white transition-colors p-1"
                    title="Settings"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>

                  <AnimatePresence>
                    {showSettings && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full right-0 mb-2 w-52 bg-surface/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-3 pt-2.5 pb-1.5">
                          <p className="text-[10px] text-muted font-semibold uppercase tracking-wider mb-1.5">Speed</p>
                          <div className="flex flex-wrap gap-1">
                            {PLAYBACK_SPEEDS.map(speed => (
                              <button
                                key={speed}
                                onClick={() => handleSpeedChange(speed)}
                                className={`text-[11px] font-medium px-2 py-1 rounded-md transition-all ${
                                  playbackSpeed === speed
                                    ? 'bg-primary text-white'
                                    : 'text-muted hover:text-white bg-white/5 hover:bg-white/10'
                                }`}
                              >
                                {speed}x
                              </button>
                            ))}
                          </div>
                        </div>

                        {qualityLevels.length > 0 && (
                          <div className="px-3 pt-2 pb-1.5 border-t border-white/5">
                            <p className="text-[10px] text-muted font-semibold uppercase tracking-wider mb-1.5">Quality</p>
                            <div className="flex flex-wrap gap-1">
                              <button
                                onClick={() => handleQualityChange(-1)}
                                className={`text-[11px] font-medium px-2 py-1 rounded-md transition-all ${
                                  currentQuality === -1
                                    ? 'bg-primary text-white'
                                    : 'text-muted hover:text-white bg-white/5 hover:bg-white/10'
                                }`}
                              >
                                Auto
                              </button>
                              {qualityLevels.map((ql) => (
                                <button
                                  key={ql.index}
                                  onClick={() => handleQualityChange(ql.index)}
                                  className={`text-[11px] font-medium px-2 py-1 rounded-md transition-all ${
                                    currentQuality === ql.index
                                      ? 'bg-primary text-white'
                                      : 'text-muted hover:text-white bg-white/5 hover:bg-white/10'
                                  }`}
                                >
                                  {ql.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {serverUrls.length > 1 && (
                          <div className="px-3 pt-2 pb-1.5 border-t border-white/5">
                            <p className="text-[10px] text-muted font-semibold uppercase tracking-wider mb-1.5">Server</p>
                            <div className="flex flex-wrap gap-1">
                              {serverUrls.map((_, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => handleServerSelect(idx)}
                                  className={`text-[11px] font-medium px-2 py-1 rounded-md transition-all ${
                                    activeServerIndex === idx
                                      ? 'bg-primary text-white'
                                      : 'text-muted hover:text-white bg-white/5 hover:bg-white/10'
                                  }`}
                                >
                                  {servers[idx]?.label || `Server ${idx + 1}`}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="px-3 pt-2 pb-2.5 border-t border-white/5">
                          <p className="text-[10px] text-muted font-semibold uppercase tracking-wider mb-1.5">Subtitles</p>
                          <p className="text-[11px] text-muted/50">Not available</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {pipSupported && (
                  <button onClick={togglePiP} className="text-white/70 hover:text-white transition-colors p-1" title="Picture-in-Picture (P)">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h12a2 2 0 012 2v3M4 6v10a2 2 0 002 2h5m-5-4h10a2 2 0 012 2v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-3z" />
                    </svg>
                  </button>
                )}

                <button onClick={toggleFullscreen} className="text-white/70 hover:text-white transition-colors p-1" title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen (F)'}>
                  {isFullscreen ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 0h-4" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {streamHasControls && resolvedType === 'iframe' && (
        <div className="absolute bottom-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex items-center gap-2">
            {serverUrls.length > 1 && (
              <button onClick={tryNextServer} className="bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 px-2 py-1 rounded text-[10px] font-medium transition-colors">
                {serverLabel}
              </button>
            )}
            <button onClick={handleRetry} className="bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 px-2 py-1 rounded text-[10px] font-medium transition-colors">Reload</button>
            {onChangeSource && <button onClick={onChangeSource} className="bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 px-2 py-1 rounded text-[10px] font-medium transition-colors">Change Source</button>}
          </div>
        </div>
      )}

      {!userClicked && !error && !allProvidersFailed && (
        <div className="absolute top-2 left-2 z-20">
          <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded font-medium">
            {episodeNumber && `Episode ${episodeNumber}`}
          </span>
        </div>
      )}
    </div>
  )
})

export default VideoPlayer
