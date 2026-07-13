import { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react'
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
  ActivityIndicator, Platform, StatusBar, Alert, Modal,
  FlatList, Animated,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { VideoView } from 'expo-video'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useColorScheme } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@anime/auth'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { getItemAsync, setItemAsync } from 'expo-secure-store'
import * as Haptics from 'expo-haptics'
import {
  getAnimeById, getAnimeBySlug, getEpisodes, getEpisodePlayData,
  getResume, saveResume,
} from '@anime/api'
import { startDownload, cancelDownload, getDownload, formatBytes } from '@/services/downloadManager'
import type { DownloadRecord } from '@/services/downloadDB'
import { Palette, DarkPalette, Typography, Spacing, BorderRadius } from '@/constants/theme'
import PlayerControls from '@/components/player/PlayerControls'
import PressableScale from '@/components/PressableScale'

const LANGUAGE_KEY = 'aw_language'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const PLAYER_HEIGHT = SCREEN_WIDTH * 9 / 16

export default function WatchScreen() {
  const { slug, episode } = useLocalSearchParams<{ slug: string; episode: string }>()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const colorScheme = useColorScheme()
  const colors = colorScheme === 'dark' ? DarkPalette : Palette
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  const currentEpNum = parseInt(episode || '1', 10)
  const [streamKey, setStreamKey] = useState(0)
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [embedLoading, setEmbedLoading] = useState(true)
  const [embedErr, setEmbedErr] = useState<string | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState('SUB')
  const [persistedLangLoaded, setPersistedLangLoaded] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPiP, setIsPiP] = useState(false)
  const [showEpDrawer, setShowEpDrawer] = useState(false)
  const [showEndOverlay, setShowEndOverlay] = useState(false)
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null)

  useEffect(() => {
    getItemAsync(LANGUAGE_KEY).then(saved => {
      if (saved === 'SUB' || saved === 'DUB') {
        setSelectedLanguage(saved)
      }
      setPersistedLangLoaded(true)
    })
  }, [])

  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamsCache = useRef<any>(null)
  const serverFailoverIdx = useRef(0)
  const retryCount = useRef(0)
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastTapRef = useRef(0)
  const lastTapXRef = useRef(0)

  // Player state (mirrored from expo-video for UI)
  const playerState = useRef({
    currentTime: 0,
    duration: 0,
    bufferedPosition: 0,
    isPlaying: false,
    status: 'loading' as string,
    isLive: false,
  }).current

  const [playerTime, setPlayerTime] = useState(0)
  const [playerDuration, setPlayerDuration] = useState(0)
  const [playerBuffered, setPlayerBuffered] = useState(0)
  const [playerPlaying, setPlayerPlaying] = useState(false)
  const [playerStatus, setPlayerStatus] = useState('loading')
  const [playbackRate, setPlaybackRate] = useState(1)
  const [subtitleTrack, setSubtitleTrack] = useState<any>(null)
  const [audioTrack, setAudioTrack] = useState<any>(null)
  const [videoTrack, setVideoTrack] = useState<any>(null)
  const [availableSubs, setAvailableSubs] = useState<any[]>([])
  const [availableAudio, setAvailableAudio] = useState<any[]>([])
  const [availableVideo, setAvailableVideo] = useState<any[]>([])

  const [expoPlayer, setExpoPlayer] = useState<any>(null)
  const playerRef = useRef<any>(null)

  // Anime data
  const isNumeric = useMemo(() => /^\d+$/.test(slug || ''), [slug])
  const animeQuery = useQuery({
    queryKey: ['anime', slug],
    queryFn: ({ signal }) =>
      isNumeric ? getAnimeById(Number(slug), signal) : getAnimeBySlug(slug, signal),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
  const anime = animeQuery.data

  const episodesQuery = useQuery({
    queryKey: ['episodes', anime?.malId],
    queryFn: ({ signal }) => getEpisodes(anime.malId!, signal),
    enabled: !!anime?.malId,
    staleTime: 10 * 60 * 1000,
  })
  const episodes = useMemo(() => {
    if (!episodesQuery.data) return []
    const sorted = [...episodesQuery.data].sort((a: any, b: any) => (a.episodeNumber || 0) - (b.episodeNumber || 0))
    return sorted.filter((e: any, i: number, arr: any[]) => i === arr.findIndex((x: any) => x.episodeNumber === e.episodeNumber))
  }, [episodesQuery.data])

  const currentEpisode = useMemo(() =>
    episodes.find((e: any) => e.episodeNumber === currentEpNum),
    [episodes, currentEpNum],
  )
  const nextEpisode = useMemo(() =>
    episodes.find((e: any) => e.episodeNumber === currentEpNum + 1),
    [episodes, currentEpNum],
  )

  // Fetch play data
  const resolvedMalId = anime?.malId || anime?.id

  const playDataQuery = useQuery({
    queryKey: ['play', resolvedMalId, currentEpisode?.embedUrl || currentEpNum],
    queryFn: ({ signal }) => getEpisodePlayData(resolvedMalId!, currentEpisode?.embedUrl || '', signal),
    enabled: !!resolvedMalId && !!currentEpisode?.embedUrl,
    staleTime: 120000,
    retry: 2,
  })

  // Process play data
  useEffect(() => {
    if (!playDataQuery.data) return
    const data = playDataQuery.data as any
    streamsCache.current = data
    serverFailoverIdx.current = 0
    retryCount.current = 0

    const langGroups = data.languages || []
    const langGroup = langGroups.find((g: any) => g.language === selectedLanguage) || langGroups[0]

    if (langGroup?.servers?.length) {
      const server = langGroup.servers.find((s: any) => s.verified && s.status === 'online') || langGroup.servers[0]
      const url = server.proxyUrl || server.url
      if (url) {
        setStreamUrl(url)
        setEmbedLoading(false)
        setEmbedErr(null)
        setStreamKey(k => k + 1)
        return
      }
    }
    setEmbedErr('No stream servers available')
    setEmbedLoading(false)
  }, [playDataQuery.data, selectedLanguage])

  // Resume playback
  useEffect(() => {
    if (!resolvedMalId || !expoPlayer) return
    getResume(resolvedMalId).then((resume: any) => {
      if (resume?.available && resume.episodeNumber === currentEpNum && resume.progressSeconds > 5) {
        Alert.alert('Resume Playback', `Continue from ${Math.floor(resume.progressSeconds / 60)}:${Math.floor(resume.progressSeconds % 60).toString().padStart(2, '0')}?`, [
          { text: 'Start Over', onPress: () => {} },
          { text: 'Resume', onPress: () => { try { expoPlayer.currentTime = resume.progressSeconds } catch {} } },
        ])
      }
    }).catch(() => {})
  }, [resolvedMalId, currentEpNum, expoPlayer])

  // Periodic progress save
  useEffect(() => {
    if (!isAuthenticated || !resolvedMalId || !expoPlayer) return
    progressInterval.current = setInterval(() => {
      try {
        const t = playerState.currentTime
        const d = playerState.duration
        if (t > 0 && d > 0) {
          saveResume(resolvedMalId, {
            episodeNumber: currentEpNum,
            progressSeconds: Math.floor(t),
            durationSeconds: Math.floor(d),
            animeTitle: anime?.title || '',
            animeImage: anime?.imageUrl || '',
          }).catch(() => {})
        }
      } catch {}
    }, 30000)
    return () => { if (progressInterval.current) clearInterval(progressInterval.current) }
  }, [isAuthenticated, resolvedMalId, currentEpNum, anime, expoPlayer])

  // Check download status
  useEffect(() => {
    if (!anime?.slug) return
    getDownload(anime.slug, currentEpNum).then((rec: DownloadRecord | null) => {
      setDownloadStatus(rec?.status ?? null)
    }).catch(() => setDownloadStatus(null))
  }, [anime?.slug, currentEpNum])

  const handleDownload = useCallback(async () => {
    if (!anime?.slug || !streamUrl) return
    if (downloadStatus === 'completed' || downloadStatus === 'downloading') {
      cancelDownload(anime.slug, currentEpNum)
      setDownloadStatus('paused')
      return
    }
    setDownloadStatus('downloading')
    try {
      await startDownload(anime.slug, currentEpNum, streamUrl, {
        animeId: anime.id,
        animeTitle: anime.title || '',
        animeImage: anime.imageUrl || anime.images?.jpg?.image_url,
        episodeTitle: currentEpisode?.title,
        episodeUrl: currentEpisode?.embedUrl,
        language: selectedLanguage,
      })
      setDownloadStatus('completed')
    } catch {
      setDownloadStatus('failed')
    }
  }, [anime, streamUrl, currentEpNum, downloadStatus, currentEpisode, selectedLanguage])

  // Keep screen awake while playing
  useEffect(() => {
    if (playerPlaying) {
      activateKeepAwakeAsync().catch(() => {})
    } else {
      deactivateKeepAwake()
    }
  }, [playerPlaying])

  // Controls auto-hide
  useEffect(() => {
    if (controlsVisible && playerPlaying) {
      controlsTimer.current = setTimeout(() => {
        setControlsVisible(false)
      }, 4000)
    }
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current)
    }
  }, [controlsVisible, playerPlaying])

  const showControls = useCallback(() => {
    setControlsVisible(true)
    if (controlsTimer.current) clearTimeout(controlsTimer.current)
  }, [])

  const toggleControls = useCallback(() => {
    setControlsVisible(v => !v)
  }, [])

  // Gesture: double-tap seek
  const handleTap = useCallback((evt: any) => {
    const now = Date.now()
    const x = evt?.nativeEvent?.locationX ?? 0
    const isLeft = x < SCREEN_WIDTH / 2
    const timeSinceLast = now - lastTapRef.current

    if (timeSinceLast < 300 && Math.abs(x - lastTapXRef.current) < 80) {
      if (expoPlayer) {
        const step = isLeft ? -10 : 10
        const newTime = Math.max(0, Math.min(playerState.duration || 0, playerState.currentTime + step))
        try { expoPlayer.currentTime = newTime } catch {}
      }
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
      lastTapXRef.current = x
      toggleControls()
    }
  }, [expoPlayer, toggleControls])

  // Player event handlers
  const onTimeUpdate = useCallback((payload: any) => {
    const t = payload.currentTime ?? payload
    const d = payload.duration ?? playerState.duration
    playerState.currentTime = t
    playerState.duration = d
    setPlayerTime(t)
    setPlayerDuration(d)
  }, [])

  const onStatusChange = useCallback((payload: any) => {
    const s = payload.status ?? payload
    playerState.status = s
    setPlayerStatus(s)
    if (s === 'readyToPlay') {
      setEmbedLoading(false)
    }
    if (s === 'error') {
      handlePlayerError(payload.error?.message || 'Playback error')
    }
  }, [])

  const onPlayingChange = useCallback((payload: any) => {
    const p = payload.playing ?? payload
    playerState.isPlaying = p
    setPlayerPlaying(p)
    if (!p) showControls()
  }, [showControls])

  const onPlaybackRateChange = useCallback((payload: any) => {
    setPlaybackRate(payload.playbackRate ?? payload)
  }, [])

  // Player error handler
  const handlePlayerError = useCallback((errMsg: string) => {
    console.warn('Player error:', errMsg)

    const cache = streamsCache.current
    if (cache?.languages) {
      const langGroup = cache.languages.find((g: any) => g.language === selectedLanguage) || cache.languages[0]
      const servers = langGroup?.servers || []
      const nextIdx = serverFailoverIdx.current + 1
      const next = servers.slice(nextIdx).find((s: any) => s.verified && s.status === 'online')

      if (next) {
        serverFailoverIdx.current = servers.indexOf(next)
        setStreamUrl(next.proxyUrl || next.url)
        setEmbedErr(null)
        setEmbedLoading(true)
        setStreamKey(k => k + 1)
        return
      }
    }

    if (retryCount.current < 2) {
      retryCount.current++
      playDataQuery.refetch()
      return
    }

    setEmbedErr('Stream temporarily unavailable. Try a different server or language.')
    setEmbedLoading(false)
  }, [selectedLanguage, playDataQuery])

  // Language switch
  const handleLanguageChange = useCallback((lang: string) => {
    if (lang === selectedLanguage) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setItemAsync(LANGUAGE_KEY, lang).catch(() => {})
    setEmbedLoading(true)
    setEmbedErr(null)
    setSelectedLanguage(lang)
    serverFailoverIdx.current = 0

    const cache = streamsCache.current
    if (cache?.languages) {
      const langGroup = cache.languages.find((g: any) => g.language === lang)
      if (langGroup?.servers?.length) {
        const server = langGroup.servers.find((s: any) => s.verified && s.status === 'online') || langGroup.servers[0]
        const url = server.proxyUrl || server.url
        if (url) {
          setStreamUrl(url)
          setEmbedLoading(false)
          setStreamKey(k => k + 1)
          return
        }
      }
    }
    playDataQuery.refetch()
  }, [selectedLanguage, playDataQuery])

  // Episode drawer
  const epDrawerGetItemLayout = useCallback(
    (_: any, index: number) => ({ length: 56, offset: 56 * index, index }),
    [],
  )

  const renderEpDrawerItem = useCallback(
    ({ item: ep }: { item: any }) => {
      const isCurrent = ep.episodeNumber === currentEpNum
      return (
        <EpDrawerItem
          ep={ep}
          isCurrent={isCurrent}
          colors={colors}
          slug={slug}
          onSelect={(num: number) => {
            setShowEpDrawer(false)
            if (num !== currentEpNum) {
              router.replace(`/anime/${slug}/ep/${num}`)
            }
          }}
        />
      )
    },
    [currentEpNum, colors, slug, router],
  )

  // Retry
  const handleRetry = useCallback(() => {
    retryCount.current = 0
    serverFailoverIdx.current = 0
    setEmbedErr(null)
    setEmbedLoading(true)
    playDataQuery.refetch()
  }, [playDataQuery])

  // Fullscreen
  const handleFullscreenToggle = useCallback(() => {
    if (isFullscreen) {
      setIsFullscreen(false)
    } else {
      setIsFullscreen(true)
    }
  }, [isFullscreen])

  // PiP
  const handlePiPToggle = useCallback(() => {
    try {
      if (expoPlayer?.startPictureInPicture) {
        expoPlayer.startPictureInPicture()
      }
    } catch {}
  }, [expoPlayer])

  // Skip intro (client heuristic: first 90s, duration > 120s)
  const showSkipIntro = playerTime > 0 && playerTime < 90 && playerDuration > 120 && !embedErr

  const handleSkipIntro = useCallback(() => {
    if (expoPlayer) {
      try { expoPlayer.currentTime = Math.min(playerDuration, 95) } catch {}
    }
  }, [expoPlayer, playerDuration])

  // Next episode
  const handleNextEpisode = useCallback(() => {
    if (nextEpisode) {
      setShowEndOverlay(false)
      router.replace(`/anime/${slug}/ep/${nextEpisode.episodeNumber}`)
    }
  }, [nextEpisode, slug, router])

  // Auto-next overlay on end
  useEffect(() => {
    if (playerDuration > 0 && playerTime >= playerDuration - 2 && playerPlaying === false && playerStatus === 'readyToPlay') {
      if (!showEndOverlay && nextEpisode) {
        setShowEndOverlay(true)
        showControls()
      }
    }
  }, [playerTime, playerDuration, playerPlaying, playerStatus, nextEpisode])

  // Setup expo-video player
  useEffect(() => {
    if (!streamUrl) return

    let mounted = true
    let player: any = null

    const setupPlayer = async () => {
      try {
        const { useVideoPlayer } = await import('expo-video')

        const p = useVideoPlayer(
          { uri: streamUrl, contentType: 'hls' },
          (playerInstance: any) => {
            playerInstance.timeUpdateEventInterval = 0.5
            playerInstance.keepScreenOnWhilePlaying = true

            const subs = playerInstance.addListener?.('timeUpdate', onTimeUpdate) ?? null
            const statusListener = playerInstance.addListener?.('statusChange', onStatusChange) ?? null
            const playingListener = playerInstance.addListener?.('playingChange', onPlayingChange) ?? null
            const rateListener = playerInstance.addListener?.('playbackRateChange', onPlaybackRateChange) ?? null

            if (subs) cleanupFns.push(subs)
            if (statusListener) cleanupFns.push(statusListener)
            if (playingListener) cleanupFns.push(playingListener)
            if (rateListener) cleanupFns.push(rateListener)

            // Track available subtitle/audio/video tracks
            const subTrackListener = playerInstance.addListener?.('availableSubtitleTracksChange', (e: any) => {
              setAvailableSubs(e?.availableSubtitleTracks || [])
            })
            const videoTrackListener = playerInstance.addListener?.('availableVideoTracksChange', (e: any) => {
              setAvailableVideo(e?.availableVideoTracks || [])
            })
            const audioTrackListener = playerInstance.addListener?.('availableAudioTracksChange', (e: any) => {
              setAvailableAudio(e?.availableAudioTracks || [])
            })
            if (subTrackListener) cleanupFns.push(subTrackListener)
            if (videoTrackListener) cleanupFns.push(videoTrackListener)
            if (audioTrackListener) cleanupFns.push(audioTrackListener)
          },
        )

        if (!mounted) return
        playerRef.current = p
        setExpoPlayer(p)
        setEmbedLoading(false)
      } catch (err: any) {
        console.warn('Failed to create player:', err)
        if (mounted) {
          setEmbedErr('Failed to initialize player')
          setEmbedLoading(false)
        }
      }
    }

    const cleanupFns: any[] = []
    setupPlayer()

    return () => {
      mounted = false
      cleanupFns.forEach((fn: any) => { try { fn.remove?.() } catch {} })
    }
  }, [streamKey, streamUrl])

  // Available languages from cached data — only what the backend returns
  const availableLanguages = useMemo(() => {
    const cache = streamsCache.current
    if (cache?.languages) {
      return cache.languages
        .filter((g: any) => g.language)
        .map((g: any) => ({ language: g.language, serverCount: g.servers?.length || 0 }))
    }
    if (cache?.availableLanguages) {
      return cache.availableLanguages.map((l: string) => ({ language: l, serverCount: 0 }))
    }
    return []
  }, [playDataQuery.data])

  const VideoViewComponent = useMemo(() => {
    if (!streamUrl) return null

    return (
        <View style={playerStyle.videoContainer}>
          <VideoView
            style={playerStyle.video}
            player={playerRef.current}
            nativeControls={false}
            contentFit="contain"
            allowsPictureInPicture={Platform.OS === 'ios'}
            onFullscreenEnter={() => setIsFullscreen(true)}
            onFullscreenExit={() => setIsFullscreen(false)}
            onPictureInPictureStart={() => setIsPiP(true)}
            onPictureInPictureStop={() => setIsPiP(false)}
          />
        </View>
      )
  }, [streamUrl, playerRef.current])

  // Loading state
  if (animeQuery.isLoading) {
    return (
      <View style={[sty.container, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#FFF" size="large" />
      </View>
    )
  }

  if (animeQuery.isError || !anime) {
    return (
      <View style={[sty.container, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#FFF" />
        <Text style={[sty.errorText, { color: '#FFF', marginTop: Spacing.md }]}>Failed to load anime</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: Spacing.md }}>
          <Text style={{ color: '#FFF', ...Typography.labelLarge }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={[sty.container, { backgroundColor: isFullscreen ? '#000' : colors.background }]}>
      <StatusBar hidden={isFullscreen} />

      {/* Player area */}
      <View style={[
        playerStyle.wrapper,
        isFullscreen && playerStyle.wrapperFullscreen,
      ]}>
        {/* Video player */}
        {streamUrl ? (
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleTap}
            style={playerStyle.touchArea}
          >
            {VideoViewComponent}

            {/* Loading overlay */}
            {embedLoading && (
              <View style={playerStyle.loadingOverlay}>
                <ActivityIndicator color="#FFF" size="large" />
                <Text style={playerStyle.loadingText}>Loading stream...</Text>
              </View>
            )}

            {/* Error overlay */}
            {embedErr && (
              <View style={playerStyle.errorOverlay}>
                <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#FFF" />
                <Text style={playerStyle.errorMsg}>{embedErr}</Text>
                <TouchableOpacity style={playerStyle.retryBtn} onPress={handleRetry}>
                  <Text style={playerStyle.retryText}>Retry</Text>
                </TouchableOpacity>
                {availableLanguages.length > 1 && (
                  <View style={playerStyle.langRow}>
                    {availableLanguages.map((l: any) => (
                      <TouchableOpacity
                        key={l.language}
                        style={[playerStyle.langBtn, l.language === selectedLanguage && playerStyle.langBtnActive]}
                        onPress={() => handleLanguageChange(l.language)}
                      >
                        <Text style={[playerStyle.langText, l.language === selectedLanguage && playerStyle.langTextActive]}>
                          {l.language}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Controls overlay */}
            {!embedErr && expoPlayer && (
              <PlayerControls
                player={expoPlayer}
                visible={controlsVisible && !embedErr}
                currentTime={playerTime}
                duration={playerDuration}
                bufferedPosition={playerBuffered}
                isPlaying={playerPlaying}
                isFullscreen={isFullscreen}
                isPiP={isPiP}
                playbackRate={playbackRate}
                subtitleTrack={subtitleTrack}
                audioTrack={audioTrack}
                videoTrack={videoTrack}
                availableSubtitleTracks={availableSubs}
                availableAudioTracks={availableAudio}
                availableVideoTracks={availableVideo}
                status={playerStatus}
                showSkipIntro={showSkipIntro}
                showNextEpisode={showEndOverlay && !!nextEpisode}
                onSkipIntro={handleSkipIntro}
                onNextEpisode={handleNextEpisode}
                onFullscreenToggle={handleFullscreenToggle}
                onPiPToggle={handlePiPToggle}
                onSettingsOpen={() => {}}
                onEpisodesOpen={() => setShowEpDrawer(true)}
                onBack={() => isFullscreen ? setIsFullscreen(false) : router.back()}
                onDoubleTapSeek={(dir) => {
                  if (expoPlayer) {
                    const newTime = Math.max(0, Math.min(playerDuration, playerTime + dir * 10))
                    try { expoPlayer.currentTime = newTime } catch {}
                  }
                }}
                colors={{
                  onSurface: '#FFF',
                  onSurfaceVariant: 'rgba(255,255,255,0.7)',
                  primary: '#FFF',
                  surfaceVariant: 'rgba(255,255,255,0.15)',
                  surfaceContainer: 'rgba(0,0,0,0.5)',
                }}
              />
            )}

            {/* End overlay */}
            {showEndOverlay && nextEpisode && (
              <View style={playerStyle.endOverlay}>
                <Text style={playerStyle.endTitle}>Up Next</Text>
                <Text style={playerStyle.endEpTitle}>
                  EP {nextEpisode.episodeNumber}: {nextEpisode.title || `Episode ${nextEpisode.episodeNumber}`}
                </Text>
                <TouchableOpacity style={playerStyle.playNextBtn} onPress={handleNextEpisode}>
                  <MaterialCommunityIcons name="play" size={20} color="#FFF" />
                  <Text style={playerStyle.playNextText}>Play Next Episode</Text>
                </TouchableOpacity>
                <TouchableOpacity style={playerStyle.cancelBtn} onPress={() => setShowEndOverlay(false)}>
                  <Text style={playerStyle.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <View style={[playerStyle.videoContainer, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }]}>
            {embedLoading ? (
              <>
                <ActivityIndicator color="#FFF" size="large" />
                <Text style={playerStyle.loadingText}>Preparing stream...</Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="play-circle-outline" size={64} color="rgba(255,255,255,0.4)" />
                <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: Spacing.sm }}>
                  {embedErr || 'No stream available'}
                </Text>
                {embedErr && (
                  <TouchableOpacity style={playerStyle.retryBtn} onPress={handleRetry}>
                    <Text style={playerStyle.retryText}>Retry</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}
      </View>

      {/* Episode info bar below player */}
      {!isFullscreen && (
        <View style={[sty.infoBar, { backgroundColor: colors.background }]}>
          <View style={sty.infoBarLeft}>
            <Text style={[sty.epBadge, { backgroundColor: colors.primary, color: colors.onPrimary }]}>
              EP {currentEpNum}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={[sty.animeTitle, { color: colors.onSurface }]} numberOfLines={1}>
                {anime?.title}
              </Text>
              <Text style={[sty.epTitle, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                {currentEpisode?.title || `Episode ${currentEpNum}`}
              </Text>
            </View>
          </View>
          <View style={sty.infoBarRight}>
            <TouchableOpacity onPress={handleDownload} style={sty.epListBtn}>
              <MaterialCommunityIcons
                name={
                  downloadStatus === 'completed' ? 'download-circle' :
                  downloadStatus === 'downloading' ? 'download-off' :
                  'download-outline'
                }
                size={24}
                color={
                  downloadStatus === 'completed' ? '#4CAF50' :
                  downloadStatus === 'downloading' ? colors.primary :
                  colors.onSurfaceVariant
                }
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowEpDrawer(true)} style={sty.epListBtn}>
              <MaterialCommunityIcons name="format-list-bulleted" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Language selector — only when multiple languages available */}
      {!isFullscreen && availableLanguages.length > 1 && (
        <View style={[sty.langRow, { backgroundColor: colors.background }]}>
          {availableLanguages.map((l: any) => {
            const isActive = l.language === selectedLanguage
            return (
              <PressableScale
                key={l.language}
                onPress={() => handleLanguageChange(l.language)}
                haptics
                hapticType="light"
                style={[sty.langChip, {
                  backgroundColor: isActive ? colors.primary : colors.surfaceContainerHigh,
                }]}
              >
                <Text style={[sty.langChipText, {
                  color: isActive ? colors.onPrimary : colors.onSurface,
                }]}>
                  {l.language}
                </Text>
              </PressableScale>
            )
          })}
        </View>
      )}

      {/* Episode Drawer Modal */}
      <Modal visible={showEpDrawer} animationType="slide" transparent>
        <View style={sty.drawerOverlay}>
          <TouchableOpacity style={sty.drawerBackdrop} onPress={() => setShowEpDrawer(false)} />
          <View style={[sty.drawerContent, { backgroundColor: colors.surfaceContainerHigh }]}>
            <View style={sty.drawerHeader}>
              <Text style={[sty.drawerTitle, { color: colors.onSurface }]}>Episodes</Text>
              <TouchableOpacity onPress={() => setShowEpDrawer(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={episodes}
              keyExtractor={(e: any) => String(e.episodeNumber || e.id)}
              showsVerticalScrollIndicator={false}
              renderItem={renderEpDrawerItem}
              getItemLayout={epDrawerGetItemLayout}
              removeClippedSubviews={true}
              initialNumToRender={20}
              maxToRenderPerBatch={15}
              windowSize={5}
              contentContainerStyle={{ paddingBottom: Spacing.xl }}
            />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const EpDrawerItem = memo(function EpDrawerItem({
  ep, isCurrent, colors, slug, onSelect,
}: {
  ep: any
  isCurrent: boolean
  colors: typeof Palette
  slug: string
  onSelect: (num: number) => void
}) {
  return (
    <TouchableOpacity
      style={[sty.epDrawerItem, isCurrent && { backgroundColor: colors.primaryContainer }]}
      onPress={() => onSelect(ep.episodeNumber)}
    >
      <View style={[sty.epDrawerNum, { backgroundColor: isCurrent ? colors.primary : colors.surfaceVariant }]}>
        <Text style={[sty.epDrawerNumText, { color: isCurrent ? colors.onPrimary : colors.onSurfaceVariant }]}>
          {ep.episodeNumber}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[sty.epDrawerTitle, { color: colors.onSurface }]} numberOfLines={1}>
          {ep.title || `Episode ${ep.episodeNumber}`}
        </Text>
      </View>
      {isCurrent && <MaterialCommunityIcons name="play" size={20} color={colors.primary} />}
    </TouchableOpacity>
  )
})

const sty = StyleSheet.create({
  container: { flex: 1 },
  errorText: { ...Typography.titleMedium, textAlign: 'center' },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  infoBarLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  epBadge: {
    ...Typography.labelMedium,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  animeTitle: { ...Typography.titleSmall, fontWeight: '600' },
  epTitle: { ...Typography.bodySmall },
  infoBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  epListBtn: {
    padding: Spacing.sm,
  },
  langRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  langChip: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  langChipText: { ...Typography.labelMedium, fontWeight: '600' },
  drawerOverlay: { flex: 1 },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawerContent: {
    maxHeight: '60%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.md,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  drawerTitle: { ...Typography.titleMedium, fontWeight: '700' },
  epDrawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  epDrawerNum: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  epDrawerNumText: { ...Typography.labelLarge, fontWeight: '700' },
  epDrawerTitle: { ...Typography.bodyMedium },
})

const playerStyle = StyleSheet.create({
  wrapper: {
    width: SCREEN_WIDTH,
    height: PLAYER_HEIGHT,
    backgroundColor: '#000',
  },
  wrapperFullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT,
    zIndex: 100,
  },
  touchArea: {
    flex: 1,
    position: 'relative',
  },
  videoContainer: {
    flex: 1,
  },
  video: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: Spacing.sm,
    ...Typography.bodyMedium,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  errorMsg: {
    color: '#FFF',
    textAlign: 'center',
    ...Typography.bodyMedium,
  },
  retryBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  retryText: {
    color: '#FFF',
    ...Typography.labelLarge,
    fontWeight: '600',
  },
  langRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  langBtn: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  langBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  langText: {
    color: 'rgba(255,255,255,0.7)',
    ...Typography.labelMedium,
  },
  langTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  endOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  endTitle: {
    color: 'rgba(255,255,255,0.6)',
    ...Typography.labelLarge,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  endEpTitle: {
    color: '#FFF',
    ...Typography.titleMedium,
    fontWeight: '600',
    textAlign: 'center',
  },
  playNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  playNextText: {
    color: '#FFF',
    ...Typography.labelLarge,
    fontWeight: '600',
  },
  cancelBtn: {
    marginTop: Spacing.xs,
    padding: Spacing.sm,
  },
  cancelText: {
    color: 'rgba(255,255,255,0.6)',
    ...Typography.labelMedium,
  },
})
