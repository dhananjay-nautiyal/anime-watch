import { useState, useCallback, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useColorScheme } from 'react-native'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { Palette, DarkPalette, Typography, Spacing, BorderRadius } from '@/constants/theme'
import {
  loadDownloadItems, removeDownload, cancelDownload, resumeDownload,
  addDownloadListener, formatBytes, formatDate,
  getDownloadStats, clearCompletedDownloads,
  type DownloadItem, type DownloadEvent,
} from '@/services/downloadManager'
import PressableScale from '@/components/PressableScale'
import EmptyState from '@/components/EmptyState'

export default function DownloadsScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const colorScheme = useColorScheme()
  const colors = colorScheme === 'dark' ? DarkPalette : Palette

  const [items, setItems] = useState<DownloadItem[]>([])
  const [stats, setStats] = useState({ totalDownloads: 0, completedDownloads: 0, totalBytes: 0, animeCount: 0 })
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [downloaded, s] = await Promise.all([loadDownloadItems(), getDownloadStats()])
    setItems(downloaded)
    setStats(s)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const unsub = addDownloadListener((_event: DownloadEvent) => { refresh() })
    return unsub
  }, [refresh])

  const handleRemove = useCallback((item: DownloadItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert('Remove Download', `Delete "${item.animeTitle} - ${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeDownload(item.animeSlug, item.episodeNumber) },
    ])
  }, [])

  const handleCancel = useCallback((item: DownloadItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    cancelDownload(item.animeSlug, item.episodeNumber)
  }, [])

  const handleResume = useCallback((item: DownloadItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    resumeDownload(item.animeSlug, item.episodeNumber)
  }, [])

  const handleClearCompleted = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert('Clear Completed', 'Remove all completed downloads?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clearCompletedDownloads() },
    ])
  }, [])

  const renderItem = useCallback(({ item }: { item: DownloadItem }) => {
    const isActive = item.status === 'downloading'
    const isCompleted = item.status === 'completed'
    const isPaused = item.status === 'paused'
    const isFailed = item.status === 'failed'

    return (
      <TouchableOpacity
        style={[dl.itemCard, { backgroundColor: colors.surfaceContainerHigh }]}
        onPress={() => router.push('/anime/' + item.animeSlug + '/ep/' + item.episodeNumber)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${item.animeTitle}, episode ${item.title}`}
      >
        <Image source={{ uri: item.imageUrl || undefined }} style={[dl.thumb, { backgroundColor: colors.surfaceVariant }]} contentFit="cover" cachePolicy="memory-disk" />
        <View style={dl.itemInfo}>
          <Text style={[dl.animeTitle, { color: colors.onSurface }]} numberOfLines={1}>{item.animeTitle}</Text>
          <Text style={[dl.epTitle, { color: colors.onSurfaceVariant }]} numberOfLines={1}>{item.title}</Text>
          {isActive && (
            <View style={dl.progressRow}>
              <View style={[dl.progressBar, { backgroundColor: colors.surfaceVariant }]}>
                <View style={[dl.progressFill, { width: `${Math.min(item.progress * 100, 100)}%`, backgroundColor: colors.primary }]} />
              </View>
              <Text style={[dl.progressText, { color: colors.onSurfaceVariant }]}>{(item.progress * 100).toFixed(0)}%</Text>
            </View>
          )}
          <Text style={[dl.meta, { color: colors.onSurfaceVariant }]}>
            {isActive && 'Downloading...'}
            {isPaused && 'Paused'}
            {isCompleted && `${formatBytes(item.totalBytes)} • ${formatDate(item.createdAt)}`}
            {isFailed && 'Failed'}
          </Text>
        </View>
        <View style={dl.actions}>
          {isActive && (
            <PressableScale onPress={() => handleCancel(item)} haptics style={dl.actionBtn}>
              <MaterialCommunityIcons name="pause-circle-outline" size={24} color={colors.onSurfaceVariant} />
            </PressableScale>
          )}
          {isPaused && (
            <PressableScale onPress={() => handleResume(item)} haptics style={dl.actionBtn}>
              <MaterialCommunityIcons name="play-circle-outline" size={24} color={colors.primary} />
            </PressableScale>
          )}
          {isFailed && (
            <PressableScale onPress={() => handleResume(item)} haptics style={dl.actionBtn}>
              <MaterialCommunityIcons name="refresh" size={24} color={colors.primary} />
            </PressableScale>
          )}
          {isCompleted && (
            <PressableScale onPress={() => handleRemove(item)} haptics hapticType="medium" style={dl.actionBtn}>
              <MaterialCommunityIcons name="delete-outline" size={24} color={colors.error} />
            </PressableScale>
          )}
        </View>
      </TouchableOpacity>
    )
  }, [colors, router, handleCancel, handleResume, handleRemove])

  if (loading) {
    return (
      <View style={[sty.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  const activeCount = items.filter(i => i.status === 'downloading').length

  return (
    <View style={[sty.container, { backgroundColor: colors.background }]}>
      <View style={[sty.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={sty.headerRow}>
          <PressableScale onPress={() => router.back()} haptics>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.onSurface} />
          </PressableScale>
          <Text style={[sty.title, { color: colors.onSurface }]}>Downloads</Text>
          {items.length > 0 && (
            <PressableScale onPress={handleClearCompleted} haptics>
              <Text style={[sty.clearText, { color: colors.primary }]}>Clear All</Text>
            </PressableScale>
          )}
        </View>
        <View style={sty.statsRow}>
          <View style={[sty.statCard, { backgroundColor: colors.surfaceContainerHigh }]}>
            <Text style={[sty.statValue, { color: colors.primary }]}>{stats.completedDownloads}</Text>
            <Text style={[sty.statLabel, { color: colors.onSurfaceVariant }]}>Completed</Text>
          </View>
          <View style={[sty.statCard, { backgroundColor: colors.surfaceContainerHigh }]}>
            <Text style={[sty.statValue, { color: colors.primary }]}>{activeCount}</Text>
            <Text style={[sty.statLabel, { color: colors.onSurfaceVariant }]}>Active</Text>
          </View>
          <View style={[sty.statCard, { backgroundColor: colors.surfaceContainerHigh }]}>
            <Text style={[sty.statValue, { color: colors.primary }]}>{stats.animeCount}</Text>
            <Text style={[sty.statLabel, { color: colors.onSurfaceVariant }]}>Series</Text>
          </View>
          <View style={[sty.statCard, { backgroundColor: colors.surfaceContainerHigh }]}>
            <Text style={[sty.statValue, { color: colors.primary }]}>{formatBytes(stats.totalBytes)}</Text>
            <Text style={[sty.statLabel, { color: colors.onSurfaceVariant }]}>Storage</Text>
          </View>
        </View>
      </View>

      {items.length === 0 ? (
        <EmptyState icon="download-off-outline" title="No Downloads" subtitle="Download episodes to watch offline" actionLabel="Browse Anime" onAction={() => router.push('/(tabs)')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => `${item.animeSlug}_${item.episodeNumber}`}
          renderItem={renderItem}
          removeClippedSubviews={true}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          contentContainerStyle={sty.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {activeCount > 0 && (
        <View style={[sty.activeBanner, { backgroundColor: colors.primaryContainer, paddingBottom: insets.bottom + Spacing.sm }]}>
          <MaterialCommunityIcons name="download" size={20} color={colors.onPrimaryContainer} />
          <Text style={[sty.activeBannerText, { color: colors.onPrimaryContainer }]}>
            {activeCount} download{activeCount > 1 ? 's' : ''} in progress
          </Text>
        </View>
      )}
    </View>
  )
}

const sty = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  title: { ...Typography.headlineSmall, fontWeight: '700', flex: 1, marginLeft: Spacing.sm },
  clearText: { ...Typography.labelLarge, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: { flex: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, alignItems: 'center' },
  statValue: { ...Typography.titleLarge, fontWeight: '700' },
  statLabel: { ...Typography.labelSmall, marginTop: 2 },
  list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxl },
  activeBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingTop: Spacing.sm, paddingHorizontal: Spacing.md },
  activeBannerText: { ...Typography.labelMedium, fontWeight: '600' },
})

const dl = StyleSheet.create({
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  thumb: { width: 56, height: 80, borderRadius: BorderRadius.sm },
  itemInfo: { flex: 1, gap: 2 },
  animeTitle: { ...Typography.bodyMedium, fontWeight: '600' },
  epTitle: { ...Typography.bodySmall },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  progressBar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { ...Typography.labelSmall, width: 36, textAlign: 'right' },
  meta: { ...Typography.labelSmall, marginTop: 2 },
  actions: { gap: 4 },
  actionBtn: { padding: 4 },
})
