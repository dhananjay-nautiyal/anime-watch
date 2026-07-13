import { useCallback } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useColorScheme } from 'react-native'
import { Palette, DarkPalette, Typography, Spacing } from '@/constants/theme'
import EmptyState from '@/components/EmptyState'

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const colorScheme = useColorScheme()
  const colors = colorScheme === 'dark' ? DarkPalette : Palette

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Favorites</Text>
      </View>

      <EmptyState
        icon="heart-outline"
        title="No favorites yet"
        subtitle="Tap the heart icon on any anime to add it to your favorites"
        actionLabel="Discover Anime"
        onAction={() => router.push('/(tabs)/search')}
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
