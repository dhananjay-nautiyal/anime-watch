import { useState, useCallback } from 'react'
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useColorScheme } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Palette, DarkPalette, Typography, Spacing, BorderRadius } from '@/constants/theme'
import PressableScale from '@/components/PressableScale'

const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy',
  'Horror', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
  'Thriller', 'Mystery', 'Psychological', 'Supernatural', 'Mecha',
]

export default function SearchScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const colorScheme = useColorScheme()
  const colors = colorScheme === 'dark' ? DarkPalette : Palette
  const [query, setQuery] = useState('')

  const handleGenrePress = useCallback((genre: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push(`/(tabs)/search?genre=${genre.toLowerCase()}`)
  }, [router])

  const handleSubmitSearch = useCallback(() => {
    if (query.trim()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      router.push(`/(tabs)/search?q=${encodeURIComponent(query.trim())}`)
    }
  }, [query, router])

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Search</Text>
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceContainerHigh }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.onSurfaceVariant} />
          <TextInput
            style={[styles.input, { color: colors.onSurface }]}
            placeholder="Search anime..."
            placeholderTextColor={colors.onSurfaceVariant}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSubmitSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search anime"
            accessibilityRole="search"
          />
          {query.length > 0 && (
            <PressableScale onPress={() => setQuery('')} haptics style={styles.clearBtn}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.onSurfaceVariant} />
            </PressableScale>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Browse by Genre</Text>
        <View style={styles.chipGrid}>
          {GENRES.map(genre => (
            <PressableScale
              key={genre}
              onPress={() => handleGenrePress(genre)}
              haptics
              style={[styles.chip, { backgroundColor: colors.surfaceContainerHigh }]}
            >
              <Text style={[styles.chipText, { color: colors.onSurfaceVariant }]}>{genre}</Text>
            </PressableScale>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurface, marginTop: Spacing.lg }]}>
          Recent Searches
        </Text>
        <View style={[styles.emptyBox, { backgroundColor: colors.surfaceContainerHigh }]}>
          <MaterialCommunityIcons name="history" size={32} color={colors.onSurfaceVariant} />
          <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>No recent searches</Text>
        </View>

        <View style={{ height: insets.bottom + Spacing.xl }} />
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
  title: {
    ...Typography.headlineMedium,
    marginBottom: Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    height: 48,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    ...Typography.bodyLarge,
    height: 48,
  },
  clearBtn: { padding: 4 },
  content: {
    padding: Spacing.md,
  },
  sectionTitle: {
    ...Typography.titleMedium,
    marginBottom: Spacing.sm,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chipText: {
    ...Typography.labelLarge,
  },
  emptyBox: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyText: {
    ...Typography.bodyMedium,
  },
})
