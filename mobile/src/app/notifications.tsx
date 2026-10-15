import { useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFocusEffect } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useColorScheme } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Palette, DarkPalette, Typography, Spacing, BorderRadius } from '@/constants/theme'
import {
  getAllNotifications, getUnreadCount, markAsRead,
  markAllAsRead, deleteNotification, clearAllNotifications,
  type NotificationRecord,
} from '@/services/notificationDB'
import PressableScale from '@/components/PressableScale'
import EmptyState from '@/components/EmptyState'

const NOTIFICATION_TYPES = [
  { key: 'all', label: 'All', icon: 'bell-outline' as const },
  { key: 'new_episode', label: 'Episodes', icon: 'play-circle-outline' as const },
  { key: 'continue_watching', label: 'Continue', icon: 'clock-outline' as const },
  { key: 'announcement', label: 'News', icon: 'bullhorn-outline' as const },
  { key: 'promotion', label: 'Promos', icon: 'tag-outline' as const },
]

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString()
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const colorScheme = useColorScheme()
  const colors = colorScheme === 'dark' ? DarkPalette : Palette
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [activeFilter, setActiveFilter] = useState('all')
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [all, unread] = await Promise.all([getAllNotifications(), getUnreadCount()])
      setNotifications(all)
      setUnreadCount(unread)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useFocusEffect(useCallback(() => { loadData() }, [loadData]))

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }, [loadData])

  const filtered = activeFilter === 'all'
    ? notifications
    : notifications.filter(n => n.type === activeFilter)

  const handleTap = useCallback(async (item: NotificationRecord) => {
    Haptics.selectionAsync()
    if (!item.read) {
      await markAsRead(item.id)
      setUnreadCount(prev => Math.max(0, prev - 1))
      setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: 1 } : n))
    }
    let data: Record<string, string> | null = null
    try { data = item.data ? JSON.parse(item.data) : null } catch { /* ignore */ }
    if (data?.animeSlug) router.push(`/anime/${data.animeSlug}`)
    else if (data?.url) router.push(data.url)
  }, [router])

  const handleDelete = useCallback((id: number) => {
    deleteNotification(id)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const handleMarkAllRead = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    await markAllAsRead()
    setUnreadCount(0)
    setNotifications(prev => prev.map(n => ({ ...n, read: 1 })))
  }, [])

  const handleClearAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert('Clear All', 'Delete all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        await clearAllNotifications()
        setNotifications([])
        setUnreadCount(0)
      }},
    ])
  }, [])

  const renderItem = useCallback(({ item }: { item: NotificationRecord }) => {
    const isUnread = !item.read
    return (
      <TouchableOpacity
        style={[
          styles.item,
          { backgroundColor: isUnread ? colors.surfaceContainerHigh : colors.surface },
          isUnread && { borderLeftWidth: 3, borderLeftColor: colors.primary },
        ]}
        onPress={() => handleTap(item)}
        onLongPress={() => handleDelete(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`${isUnread ? 'Unread: ' : ''}${item.title}. ${item.body}`}
      >
        <View style={[styles.iconCircle, { backgroundColor: colors.primaryContainer }]}>
          <MaterialCommunityIcons
            name={item.type === 'new_episode' ? 'play-circle-outline'
              : item.type === 'continue_watching' ? 'clock-outline'
              : item.type === 'announcement' ? 'bullhorn-outline'
              : item.type === 'promotion' ? 'tag-outline' : 'bell-outline'}
            size={20} color={colors.onPrimaryContainer}
          />
        </View>
        <View style={styles.contentArea}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={1}>{item.title}</Text>
            <Text style={[styles.time, { color: colors.onSurfaceVariant }]}>{formatDate(item.receivedAt)}</Text>
          </View>
          <Text style={[styles.body, { color: colors.onSurfaceVariant }]} numberOfLines={2}>{item.body}</Text>
        </View>
        <PressableScale onPress={() => handleDelete(item.id)} haptics style={styles.deleteBtn}>
          <MaterialCommunityIcons name="close" size={18} color={colors.onSurfaceVariant} />
        </PressableScale>
      </TouchableOpacity>
    )
  }, [colors, handleTap, handleDelete])

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerRow}>
          <PressableScale onPress={() => router.back()} haptics>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.onSurface} />
          </PressableScale>
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Notifications</Text>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            {unreadCount > 0 && (
              <PressableScale onPress={handleMarkAllRead} haptics>
                <MaterialCommunityIcons name="email-check-outline" size={24} color={colors.primary} />
              </PressableScale>
            )}
            {notifications.length > 0 && (
              <PressableScale onPress={handleClearAll} haptics>
                <MaterialCommunityIcons name="delete-sweep-outline" size={24} color={colors.error} />
              </PressableScale>
            )}
          </View>
        </View>

        <FlatList
          horizontal
          data={NOTIFICATION_TYPES}
          keyExtractor={item => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => {
            const isActive = activeFilter === item.key
            return (
              <PressableScale
                onPress={() => { Haptics.selectionAsync(); setActiveFilter(item.key) }}
                style={[styles.filterChip, { backgroundColor: isActive ? colors.primary : colors.surfaceContainerHigh }]}
              >
                <MaterialCommunityIcons name={item.icon} size={16} color={isActive ? colors.onPrimary : colors.onSurfaceVariant} />
                <Text style={[styles.filterLabel, { color: isActive ? colors.onPrimary : colors.onSurfaceVariant }]}>{item.label}</Text>
              </PressableScale>
            )
          }}
        />
      </View>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <EmptyState icon="bell-off-outline" title="No notifications yet" subtitle="Notifications from new episodes, reminders, and announcements will appear here" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          removeClippedSubviews={true}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
      <View style={{ height: insets.bottom + Spacing.md }} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  pageTitle: { ...Typography.headlineSmall, flex: 1, marginLeft: Spacing.sm },
  filterRow: { gap: Spacing.sm, paddingBottom: Spacing.xs },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: BorderRadius.full },
  filterLabel: { ...Typography.labelLarge },
  list: { paddingHorizontal: Spacing.md, flexGrow: 1 },
  item: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, marginBottom: Spacing.xs, borderRadius: BorderRadius.md, gap: Spacing.sm },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  contentArea: { flex: 1 },
  title: { ...Typography.bodyLarge, fontWeight: '600' },
  time: { ...Typography.labelSmall, marginLeft: Spacing.sm },
  body: { ...Typography.bodyMedium },
  deleteBtn: { padding: 4 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
})
