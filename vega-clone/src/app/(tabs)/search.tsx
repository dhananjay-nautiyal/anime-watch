import React, { useState } from 'react'
import { View, Text, TextInput, FlatList, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { searchMedia, posterUrl, titleOf, type MediaItem } from '@/services/tmdb'
import { DarkPalette, Spacing, BorderRadius } from '@/constants/theme'
import { MediaCard } from '@/components/MediaCard'

export default function SearchScreen() {
  const [q, setQ] = useState('')
  const [submitted, setSubmitted] = useState('')
  const router = useRouter()
  const query = useQuery({ queryKey: ['search', submitted], queryFn: () => searchMedia(submitted), enabled: submitted.trim().length > 1 })
  const data = query.data ?? []

  return (
    <View style={{ flex: 1, backgroundColor: DarkPalette.background, paddingTop: 50 }}>
      <View style={styles.searchBar}>
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => setSubmitted(q)}
          placeholder="Search movies & shows"
          placeholderTextColor={DarkPalette.onSurfaceVariant}
          style={styles.input}
          returnKeyType="search"
        />
      </View>
      <FlatList
        data={data}
        keyExtractor={(item) => `${item.media_type}-${item.id}`}
        numColumns={3}
        contentContainerStyle={{ padding: Spacing.md }}
        columnWrapperStyle={{ gap: Spacing.sm, marginBottom: Spacing.md }}
        renderItem={({ item }) => (
          <MediaCard item={item} width={( (require('react-native').Dimensions.get('window').width - Spacing.md*2 - Spacing.sm*2) / 3)} onPress={() => router.push({ pathname: '/details/[id]', params: { id: String(item.id), type: item.media_type ?? 'movie' } } as never)} />
        )}
        ListEmptyComponent={
          query.isFetching ? null : <Text style={{ color: DarkPalette.onSurfaceVariant, textAlign: 'center', marginTop: 40 }}>No results</Text>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  searchBar: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  input: {
    backgroundColor: DarkPalette.surfaceContainer,
    color: DarkPalette.onSurface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 16,
  },
})