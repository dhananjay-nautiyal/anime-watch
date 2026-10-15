import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useColorScheme } from 'react-native'
import { Palette, DarkPalette, Typography, Spacing } from '@/constants/theme'
import EmptyState from '@/components/EmptyState'
import { useAuth } from '@anime/auth'

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const colorScheme = useColorScheme()
  const colors = colorScheme === 'dark' ? DarkPalette : Palette
  const { isAuthenticated } = useAuth()

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Favorites</Text>
      </View>

      <EmptyState
        icon="heart-outline"
        title={isAuthenticated ? 'No favorites yet' : 'Sign in to save favorites'}
        subtitle={isAuthenticated ? 'Tap the heart icon on any anime to add it to your favorites' : 'Your favorites sync with your account on every device'}
        actionLabel={isAuthenticated ? 'Discover Anime' : 'Sign In'}
        onAction={() => router.push(isAuthenticated ? '/(tabs)/search' : '/login')}
      />
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
})
