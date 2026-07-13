import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Alert, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useColorScheme } from 'react-native'
import { useAuth } from '@anime/auth'
import { getNotificationPreferences, updateNotificationPreferences } from '@anime/api'
import * as Haptics from 'expo-haptics'
import { Palette, DarkPalette, Typography, Spacing, BorderRadius } from '@/constants/theme'
import { registerForPushNotificationsAsync, syncPushTokenWithBackend } from '@/services/notifications'
import PressableScale from '@/components/PressableScale'

const NOTIFICATION_TYPE_LABELS: Record<string, { label: string; desc: string; icon: string }> = {
  new_episode: { label: 'New Episodes', desc: 'When a new episode of anime in your watchlist is available', icon: 'play-circle-outline' },
  watch_reminder: { label: 'Watch Reminders', desc: 'Periodic reminders to catch up on your watchlist', icon: 'alarm-outline' },
  continue_watching: { label: 'Continue Watching', desc: "Reminders for episodes you haven't finished", icon: 'clock-outline' },
  announcement: { label: 'Announcements', desc: 'Important updates and new features', icon: 'bullhorn-outline' },
  promotion: { label: 'Promotions', desc: 'Special offers and promotional content', icon: 'tag-outline' },
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const colorScheme = useColorScheme()
  const colors = colorScheme === 'dark' ? DarkPalette : Palette
  const { isAuthenticated } = useAuth()

  const [preferences, setPreferences] = useState<Record<string, boolean>>({
    new_episode: true, watch_reminder: true, continue_watching: true, announcement: true, promotion: false,
  })
  const [pushEnabled, setPushEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => { loadPreferences() }, [])

  const loadPreferences = async () => {
    try {
      if (isAuthenticated) {
        const res = await getNotificationPreferences()
        if (res.data?.data) setPreferences(prev => ({ ...prev, ...res.data.data }))
      }
      const token = await registerForPushNotificationsAsync()
      setPushEnabled(!!token)
    } catch { /* defaults */ }
    finally { setLoading(false) }
  }

  const togglePreference = useCallback(async (key: string) => {
    Haptics.selectionAsync()
    const newVal = !preferences[key]
    setSaving(key)
    setPreferences(prev => ({ ...prev, [key]: newVal }))
    try {
      if (isAuthenticated) await updateNotificationPreferences({ [key]: newVal })
    } catch { setPreferences(prev => ({ ...prev, [key]: !newVal })) }
    finally { setSaving(null) }
  }, [preferences, isAuthenticated])

  const handleReRegister = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setLoading(true)
    try {
      await syncPushTokenWithBackend()
      Alert.alert('Success', 'Push notification token registered successfully.')
      const token = await registerForPushNotificationsAsync()
      setPushEnabled(!!token)
    } catch { Alert.alert('Error', 'Failed to register push token.') }
    finally { setLoading(false) }
  }, [])

  interface SectionItem {
    icon: keyof typeof MaterialCommunityIcons.glyphMap
    label: string
    desc: string
    value: boolean
    key: string
    onToggle?: () => void
  }

  const sections: { title: string; items: SectionItem[] }[] = [
    {
      title: 'Notifications',
      items: Object.entries(NOTIFICATION_TYPE_LABELS).map(([key, meta]) => ({
        icon: meta.icon as keyof typeof MaterialCommunityIcons.glyphMap,
        label: meta.label, desc: meta.desc,
        value: preferences[key] ?? false,
        onToggle: () => togglePreference(key), key,
      })),
    },
    {
      title: 'Push Device',
      items: [{
        icon: 'cellphone-check' as const, label: 'Push Notifications',
        desc: pushEnabled ? 'Push notifications are active' : 'Enable notifications to receive push alerts',
        value: pushEnabled, key: 'push',
      }],
    },
  ]

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerRow}>
          <PressableScale onPress={() => router.back()} haptics>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.onSurface} />
          </PressableScale>
          <Text style={[styles.title, { color: colors.onSurface }]}>Settings</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {sections.map(section => (
            <View key={section.title} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant }]}>{section.title}</Text>
              <View style={[styles.card, { backgroundColor: colors.surfaceContainerHigh }]}>
                {section.items.map((item, idx) => (
                  <View key={item.key} style={[
                    styles.settingItem,
                    idx < section.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
                  ]}>
                    <MaterialCommunityIcons name={item.icon} size={24} color={colors.onSurfaceVariant} />
                    <View style={styles.settingInfo}>
                      <Text style={[styles.settingLabel, { color: colors.onSurface }]}>{item.label}</Text>
                      <Text style={[styles.settingDesc, { color: colors.onSurfaceVariant }]}>{item.desc}</Text>
                    </View>
                    {item.key === 'push' ? (
                      <PressableScale onPress={handleReRegister} haptics style={[styles.reRegisterBtn, { borderColor: colors.primary }]}>
                        <Text style={[styles.reRegisterText, { color: colors.primary }]}>Refresh</Text>
                      </PressableScale>
                    ) : (
                      <View style={styles.switchRow}>
                        {saving === item.key && <ActivityIndicator size="small" color={colors.primary} />}
                        <Switch
                          value={item.value}
                          onValueChange={() => item.onToggle?.()}
                          trackColor={{ false: colors.outlineVariant, true: colors.primaryContainer }}
                          thumbColor={item.value ? colors.primary : colors.outline}
                          accessibilityLabel={`Toggle ${item.label}`}
                        />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          ))}
          <View style={{ height: insets.bottom + Spacing.xxl }} />
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { ...Typography.headlineSmall },
  content: { padding: Spacing.md },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.titleSmall, marginBottom: Spacing.sm, paddingHorizontal: Spacing.xs, textTransform: 'uppercase', letterSpacing: 1 },
  card: { borderRadius: BorderRadius.lg, overflow: 'hidden' },
  settingItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  settingInfo: { flex: 1 },
  settingLabel: { ...Typography.bodyLarge },
  settingDesc: { ...Typography.bodySmall, marginTop: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  reRegisterBtn: { borderWidth: 1, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  reRegisterText: { ...Typography.labelLarge },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
})
