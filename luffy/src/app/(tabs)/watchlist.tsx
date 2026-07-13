import { useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useColorScheme } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Palette, DarkPalette, Typography, Spacing, BorderRadius } from '@/constants/theme'
import PressableScale from '@/components/PressableScale'
import EmptyState from '@/components/EmptyState'

const STATUS_FILTERS = ['All', 'Watching', 'Completed', 'On Hold', 'Dropped', 'Plan to Watch']

export default function WatchlistScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const colorScheme = useColorScheme()
  const colors = colorScheme === 'dark' ? DarkPalette : Palette
  const [activeFilter, setActiveFilter] = useState('All')

  const handleFilterPress = useCallback((status: string) => {
    Haptics.selectionAsync()
    setActiveFilter(status)
  }, [])

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Watchlist</Text>
      </View>

      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
          {STATUS_FILTERS.map(status => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                { backgroundColor: activeFilter === status ? colors.primary : colors.surfaceContainerHigh },
              ]}
              onPress={() => handleFilterPress(status)}
              accessibilityRole="button"
              accessibilityState={{ selected: activeFilter === status }}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: activeFilter === status ? colors.onPrimary : colors.onSurfaceVariant },
                ]}
              >
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <EmptyState
        icon="bookmark-outline"
        title="Your watchlist is empty"
        subtitle="Start adding anime to keep track of what you're watching"
        actionLabel="Browse Anime"
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
  filterRow: { marginBottom: Spacing.sm },
  filterContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  filterChip: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  filterText: { ...Typography.labelLarge },
})
