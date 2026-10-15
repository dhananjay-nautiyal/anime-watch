import { useState, useCallback, useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  PanResponder, Dimensions, Platform, ScrollView,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import type { VideoPlayer, SubtitleTrack, AudioTrack, VideoTrack } from 'expo-video'
import { Typography, Spacing, BorderRadius } from '@/constants/theme'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const SEEK_STEP = 10
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

interface Props {
  player: VideoPlayer
  visible: boolean
  currentTime: number
  duration: number
  bufferedPosition: number
  isPlaying: boolean
  isFullscreen: boolean
  isPiP: boolean
  playbackRate: number
  subtitleTrack: SubtitleTrack | null
  audioTrack: AudioTrack | null
  videoTrack: VideoTrack | null
  availableSubtitleTracks: SubtitleTrack[]
  availableAudioTracks: AudioTrack[]
  availableVideoTracks: VideoTrack[]
  status: string
  showSkipIntro: boolean
  showNextEpisode: boolean
  onSkipIntro: () => void
  onNextEpisode: () => void
  onFullscreenToggle: () => void
  onPiPToggle: () => void
  onSettingsOpen: () => void
  onEpisodesOpen: () => void
  onBack: () => void
  onDoubleTapSeek: (direction: -1 | 1) => void
  colors: {
    onSurface: string
    onSurfaceVariant: string
    primary: string
    surfaceVariant: string
    surfaceContainer: string
  }
}

function formatTime(s: number) {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function PlayerControls({
  player, visible, currentTime, duration, bufferedPosition,
  isPlaying, isFullscreen, isPiP, playbackRate,
  subtitleTrack, audioTrack, videoTrack,
  availableSubtitleTracks, availableAudioTracks, availableVideoTracks,
  status, showSkipIntro, showNextEpisode,
  onSkipIntro, onNextEpisode, onFullscreenToggle, onPiPToggle,
  onSettingsOpen, onEpisodesOpen, onBack, onDoubleTapSeek, colors,
}: Props) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'speed' | 'quality' | 'subs' | 'audio' | null>(null)
  const [seeking, setSeeking] = useState(false)
  const [seekTime, setSeekTime] = useState(0)
  const seekingRef = useRef(false)
  const seekTimeRef = useRef(0)

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start()
  }, [visible, opacity])

  const progress = duration > 0 ? currentTime / duration : 0
  const bufferedProgress = duration > 0 ? bufferedPosition / duration : 0

  const showSpeed = (player as any).playbackRate !== undefined
  const showVideoTracks = availableVideoTracks.length > 0
  const showSubTracks = availableSubtitleTracks.length > 0
  const showAudioTracks = availableAudioTracks.length > 1

  const seekBarPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gesture) => {
        seekingRef.current = true
        setSeeking(true)
        const newTime = (gesture.x0 / SCREEN_WIDTH) * duration
        seekTimeRef.current = Math.max(0, Math.min(duration, newTime))
        setSeekTime(seekTimeRef.current)
      },
      onPanResponderMove: (_, gesture) => {
        const newTime = (gesture.moveX / SCREEN_WIDTH) * duration
        seekTimeRef.current = Math.max(0, Math.min(duration, newTime))
        setSeekTime(seekTimeRef.current)
      },
      onPanResponderRelease: () => {
        if (seekingRef.current && player) {
          player.currentTime = seekTimeRef.current
        }
        seekingRef.current = false
        setSeeking(false)
      },
    }),
  ).current

  const handleQualitySelect = useCallback((track: VideoTrack) => {
    try {
      (player as any).videoTrack = track
    } catch {}
    setShowSettings(false)
  }, [player])

  const handleSubtitleSelect = useCallback((track: SubtitleTrack | null) => {
    try { player.subtitleTrack = track } catch {}
    setShowSettings(false)
  }, [player])

  const handleAudioSelect = useCallback((track: AudioTrack | null) => {
    try { player.audioTrack = track } catch {}
    setShowSettings(false)
  }, [player])

  const handleSpeedChange = useCallback((speed: number) => {
    try { player.playbackRate = speed } catch {}
    setShowSettings(false)
  }, [player])

  const currentQualityLabel = videoTrack?.size ? `${videoTrack.size.width}x${videoTrack.size.height}` : 'Auto'
  const currentSubLabel = subtitleTrack ? subtitleTrack.label || subtitleTrack.language : 'Off'
  const currentAudioLabel = audioTrack ? audioTrack.label || audioTrack.language : 'Track 1'

  if (!visible && !showSettings) {
    return <Animated.View style={[styles.hideOverlay, { opacity }]} pointerEvents="none" />
  }

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.topBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onEpisodesOpen} style={styles.epBtn}>
          <Text style={styles.epBtnText}>Episodes</Text>
        </TouchableOpacity>
        <View style={styles.topRight}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity onPress={onPiPToggle} style={styles.topBtn}>
              <MaterialCommunityIcons name="monitor-dashboard" size={22} color="#FFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onFullscreenToggle} style={styles.topBtn}>
            <MaterialCommunityIcons name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'} size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Center play/pause */}
      {!isPlaying && !seeking && (
        <TouchableOpacity style={styles.centerPlay} onPress={() => player.play()} activeOpacity={0.7}>
          <View style={styles.playCircle}>
            <MaterialCommunityIcons name="play" size={36} color="#FFF" />
          </View>
        </TouchableOpacity>
      )}

      {/* Skip intro */}
      {showSkipIntro && visible && (
        <TouchableOpacity style={styles.skipIntroBtn} onPress={onSkipIntro} activeOpacity={0.7}>
          <Text style={styles.skipIntroText}>Skip Intro</Text>
          <MaterialCommunityIcons name="skip-forward" size={18} color="#FFF" />
        </TouchableOpacity>
      )}

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        {/* Seek bar */}
        <View style={styles.seekRow} {...seekBarPan.panHandlers}>
          <View style={styles.seekBg}>
            <View style={[styles.seekBuffered, { width: `${bufferedProgress * 100}%` }]} />
            <View style={[styles.seekProgress, { width: seeking ? `${(seekTime / duration) * 100}%` : `${progress * 100}%` }]} />
            <View style={[styles.seekThumb, {
              left: seeking
                ? `${(seekTime / duration) * 100}%`
                : `${progress * 100}%`,
            }]} />
          </View>
        </View>

        {/* Time row */}
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>
            {seeking ? formatTime(seekTime) : formatTime(currentTime)}
          </Text>
          <TouchableOpacity style={styles.settingsChip} onPress={() => {
            setSettingsTab('speed')
            setShowSettings(!showSettings || settingsTab !== 'speed')
          }}>
            <MaterialCommunityIcons name="speedometer" size={16} color="#FFF" />
            <Text style={styles.chipText}>{playbackRate}x</Text>
          </TouchableOpacity>
          {currentQualityLabel !== 'Auto' && (
            <TouchableOpacity style={styles.settingsChip} onPress={() => {
              setSettingsTab('quality')
              setShowSettings(!showSettings || settingsTab !== 'quality')
            }}>
              <Text style={styles.chipText}>{currentQualityLabel}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.settingsChip} onPress={() => {
            setSettingsTab('subs')
            setShowSettings(!showSettings || settingsTab !== 'subs')
          }}>
            <Text style={styles.chipText}>{currentSubLabel === 'Off' ? 'CC' : currentSubLabel}</Text>
          </TouchableOpacity>
          {showAudioTracks && (
            <TouchableOpacity style={styles.settingsChip} onPress={() => {
              setSettingsTab('audio')
              setShowSettings(!showSettings || settingsTab !== 'audio')
            }}>
              <MaterialCommunityIcons name="music" size={16} color="#FFF" />
              <Text style={styles.chipText}>{currentAudioLabel}</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>

        {/* Settings panel */}
        {showSettings && (
          <View style={[styles.settingsPanel, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
            {settingsTab === 'speed' && (
              <View style={styles.settingsGrid}>
                {SPEEDS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.settingItem, s === playbackRate && styles.settingActive]}
                    onPress={() => handleSpeedChange(s)}
                  >
                    <Text style={[styles.settingText, s === playbackRate && styles.settingTextActive]}>
                      {s}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {settingsTab === 'quality' && showVideoTracks && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity style={[styles.settingItem, !videoTrack && styles.settingActive]}
                  onPress={() => handleQualitySelect(null as any)}>
                  <Text style={[styles.settingText, !videoTrack && styles.settingTextActive]}>Auto</Text>
                </TouchableOpacity>
                {availableVideoTracks.map((t, i) => (
                  <TouchableOpacity
                    key={t.id || i}
                    style={[styles.settingItem, videoTrack?.id === t.id && styles.settingActive]}
                    onPress={() => handleQualitySelect(t)}
                  >
                    <Text style={[styles.settingText, videoTrack?.id === t.id && styles.settingTextActive]}>
                      {t.size ? `${t.size.width}x${t.size.height}` : `Track ${i + 1}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {settingsTab === 'subs' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity style={[styles.settingItem, !subtitleTrack && styles.settingActive]}
                  onPress={() => handleSubtitleSelect(null)}>
                  <Text style={[styles.settingText, !subtitleTrack && styles.settingTextActive]}>Off</Text>
                </TouchableOpacity>
                {availableSubtitleTracks.map((t, i) => (
                  <TouchableOpacity
                    key={t.id || i}
                    style={[styles.settingItem, subtitleTrack?.id === t.id && styles.settingActive]}
                    onPress={() => handleSubtitleSelect(t)}
                  >
                    <Text style={[styles.settingText, subtitleTrack?.id === t.id && styles.settingTextActive]}>
                      {t.label || t.language || `Track ${i + 1}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {settingsTab === 'audio' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {availableAudioTracks.map((t, i) => (
                  <TouchableOpacity
                    key={t.id || i}
                    style={[styles.settingItem, audioTrack?.id === t.id && styles.settingActive]}
                    onPress={() => handleAudioSelect(t)}
                  >
                    <Text style={[styles.settingText, audioTrack?.id === t.id && styles.settingTextActive]}>
                      {t.label || t.language || `Track ${i + 1}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>

      {/* Next episode button */}
      {showNextEpisode && (
        <TouchableOpacity style={styles.nextEpBtn} onPress={onNextEpisode} activeOpacity={0.7}>
          <Text style={styles.nextEpText}>Next Episode</Text>
          <MaterialCommunityIcons name="skip-next" size={24} color="#FFF" />
        </TouchableOpacity>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  hideOverlay: {
    ...StyleSheet.absoluteFill,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  epBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  epBtnText: {
    ...Typography.labelMedium,
    color: '#FFF',
    fontWeight: '600',
  },
  topRight: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  centerPlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipIntroBtn: {
    position: 'absolute',
    top: '38%',
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  skipIntroText: {
    ...Typography.labelMedium,
    color: '#FFF',
    fontWeight: '600',
  },
  bottomBar: {
    paddingBottom: Platform.OS === 'ios' ? 30 : Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  seekRow: {
    paddingVertical: Spacing.xs,
    cursor: 'pointer',
  },
  seekBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    position: 'relative',
    overflow: 'visible',
  },
  seekBuffered: {
    position: 'absolute',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  seekProgress: {
    position: 'absolute',
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 2,
  },
  seekThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFF',
    marginLeft: -7,
    top: -5,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  timeText: {
    ...Typography.labelSmall,
    color: '#FFF',
    fontVariant: ['tabular-nums'],
  },
  settingsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  chipText: {
    ...Typography.labelSmall,
    color: '#FFF',
    fontWeight: '600',
    fontSize: 11,
  },
  settingsPanel: {
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  settingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  settingItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  settingActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  settingText: {
    ...Typography.labelMedium,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  settingTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  nextEpBtn: {
    position: 'absolute',
    bottom: 120,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  nextEpText: {
    ...Typography.labelLarge,
    color: '#FFF',
    fontWeight: '600',
  },
})
