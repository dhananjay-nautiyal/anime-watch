import { useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, TextInput, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useColorScheme } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Palette, DarkPalette, Typography, Spacing, BorderRadius } from '@/constants/theme'
import PressableScale from '@/components/PressableScale'
import AnimeCard from '@/components/AnimeCard'
import { searchAnime } from '@anime/api'

const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy',
  'Horror', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
  'Thriller', 'Mystery', 'Psychological', 'Supernatural', 'Mecha',
]

export default function SearchScreen() {
  const insets = useSafeAreaInsets()
  const colorScheme = useColorScheme()
  const colors = colorScheme === 'dark' ? DarkPalette : Palette
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [searchError, setSearchError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestRef = useRef(0)

  const runSearch = useCallback(async (q: string) => {
    const term = q.trim()
    if (!term) {
      setResults([])
      setSearched(false)
      setSearchError('')
      setSearching(false)
      return
    }
    const id = ++requestRef.current
    setSearching(true)
    setSearchError('')
    try {
      const res = await searchAnime(term, 0, 25)
      if (requestRef.current !== id) return
      setResults(res?.data ?? [])
      setSearched(true)
    } catch {
      if (requestRef.current !== id) return
      setResults([])
      setSearched(true)
      setSearchError('Search failed. Check your connection and retry.')
    } finally {
      if (requestRef.current === id) setSearching(false)
    }
  }, [])

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!text.trim()) {
      runSearch('')
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(() => runSearch(text), 450)
  }, [runSearch])

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  const handleGenrePress = useCallback((genre: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setQuery(genre)
    runSearch(genre)
  }, [runSearch])

  const handleSubmitSearch = useCallback(() => {
    if (query.trim()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      runSearch(query)
    }
  }, [query, runSearch])

  const showResults = searched || searching || results.length > 0

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
            onChangeText={handleQueryChange}
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
        {showResults ? (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
              {searching ? 'Searching…' : `Results (${results.length})`}
            </Text>
            {searching && results.length === 0 ? (
              <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: Spacing.lg }} />
            ) : searchError ? (
              <View style={[styles.emptyBox, { backgroundColor: colors.surfaceContainerHigh }]}>
                <MaterialCommunityIcons name="cloud-off-outline" size={32} color={colors.onSurfaceVariant} />
                <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>{searchError}</Text>
              </View>
            ) : results.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: colors.surfaceContainerHigh }]}>
                <MaterialCommunityIcons name="magnify-close" size={32} color={colors.onSurfaceVariant} />
                <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>No anime found. Try another title.</Text>
              </View>
            ) : (
              <View style={styles.resultsGrid}>
                {results.map((item: any, i: number) => (
                  <AnimeCard key={item.slug || item.malId || item.id || i} anime={item} index={i} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View>
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
          </View>
        )}
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
  resultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'space-between',
  },
})
