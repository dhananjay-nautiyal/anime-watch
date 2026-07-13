import { useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useColorScheme } from 'react-native'
import { useAuth } from '@anime/auth'
import * as Haptics from 'expo-haptics'
import { Palette, DarkPalette, Typography, Spacing, BorderRadius } from '@/constants/theme'
import PressableScale from '@/components/PressableScale'

interface MenuItem {
  icon: keyof typeof MaterialCommunityIcons.glyphMap
  label: string
  route?: string
  action?: () => void
  destructive?: boolean
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const colorScheme = useColorScheme()
  const colors = colorScheme === 'dark' ? DarkPalette : Palette
  const { user, logout } = useAuth()

  const menuItems: MenuItem[] = [
    { icon: 'account-cog-outline', label: 'Settings', route: '/settings' },
    { icon: 'download-outline', label: 'Downloads', route: '/downloads' },
    { icon: 'bell-outline', label: 'Notifications', route: '/notifications' },
    { icon: 'clock-outline', label: 'Continue Watching', route: '/continue-watching' },
  ]

  const handleMenuPress = useCallback((item: MenuItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (item.action) item.action()
    else if (item.route) router.push(item.route)
  }, [router])

  const handleLogout = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    logout()
  }, [logout])

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.avatarSection, { backgroundColor: colors.surfaceContainerHigh }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}>
            <MaterialCommunityIcons name="account" size={40} color={colors.onPrimaryContainer} />
          </View>
          <View style={styles.avatarInfo}>
            <Text style={[styles.userName, { color: colors.onSurface }]}>
              {user?.name ?? 'User'}
            </Text>
            <Text style={[styles.userEmail, { color: colors.onSurfaceVariant }]}>
              {user?.email ?? 'Sign in to manage your account'}
            </Text>
          </View>
        </View>

        <View style={[styles.menuCard, { backgroundColor: colors.surfaceContainerHigh }]}>
          {menuItems.map((item, index) => (
            <PressableScale
              key={item.label}
              onPress={() => handleMenuPress(item)}
              haptics
              style={[
                styles.menuItem,
                index < menuItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
              ]}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={24}
                color={colors.onSurfaceVariant}
              />
              <Text style={[styles.menuLabel, { color: colors.onSurface }]}>
                {item.label}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.onSurfaceVariant} />
            </PressableScale>
          ))}
        </View>

        <PressableScale
          onPress={handleLogout}
          haptics
          hapticType="medium"
          style={[styles.logoutButton, { backgroundColor: colors.errorContainer }]}
        >
          <MaterialCommunityIcons name="logout" size={24} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Sign Out</Text>
        </PressableScale>

        <View style={{ height: insets.bottom + Spacing.xxl }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { ...Typography.headlineMedium },
  content: {
    padding: Spacing.md,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInfo: { flex: 1 },
  userName: {
    ...Typography.titleLarge,
  },
  userEmail: {
    ...Typography.bodyMedium,
  },
  menuCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  menuLabel: {
    ...Typography.bodyLarge,
    flex: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  logoutText: {
    ...Typography.labelLarge,
    fontWeight: '600',
  },
})
