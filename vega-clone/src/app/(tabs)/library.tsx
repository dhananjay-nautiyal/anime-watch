import React from 'react'
import { View, Text, FlatList, Pressable, Image, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useWatchlist } from '@/storage/WatchlistProvider'
import { posterUrl, titleOf } from '@/services/tmdb'
import { DarkPalette, Spacing, BorderRadius } from '@/constants/theme'

export default function LibraryScreen() {
  const { items, remove } = useWatchlist()
  const router = useRouter()
  return (
    <View style={{ flex: 1, backgroundColor: DarkPalette.background, paddingTop: 50 }}>
      <Text style={{ color: DarkPalette.onSurface, fontSize: 24, fontWeight: '700', paddingHorizontal: Spacing.md, marginBottom: Spacing.md }}>Library</Text>
      {items.length === 0 ? (
        <Text style={{ color: DarkPalette.onSurfaceVariant, textAlign: 'center', marginTop: 40 }}>Your library is empty</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => `${i.type}-${i.id}`}
          contentContainerStyle={{ padding: Spacing.md }}
          renderItem={({ item }) => {
            const uri = posterUrl(item.poster_path)
            return (
              <Pressable style={styles.row} onPress={() => router.push({ pathname: '/details/[id]', params: { id: String(item.id), type: item.type } } as never)}>
                {uri ? <Image source={{ uri }} style={styles.poster} /> : <View style={[styles.poster, { backgroundColor: DarkPalette.surfaceContainer }]} />}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: DarkPalette.onSurface, fontWeight: '600' }}>{item.title}</Text>
                  <Text style={{ color: DarkPalette.onSurfaceVariant, marginTop: 4, fontSize: 12 }}>{item.type.toUpperCase()}</Text>
                </View>
                <Pressable onPress={() => remove(item.id, item.type)} hitSlop={8}>
                  <Text style={{ color: DarkPalette.error }}>✕</Text>
                </Pressable>
              </Pressable>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: BorderRadius.md, backgroundColor: DarkPalette.surfaceContainer, marginBottom: Spacing.sm },
  poster: { width: 56, height: 84, borderRadius: BorderRadius.sm, backgroundColor: DarkPalette.surfaceVariant },
})