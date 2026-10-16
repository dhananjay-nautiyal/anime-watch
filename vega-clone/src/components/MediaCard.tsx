import React from 'react'
import { View, Text, Pressable, Image, StyleSheet } from 'react-native'
import { posterUrl, titleOf, type MediaItem } from '@/services/tmdb'
import { Palette, DarkPalette, BorderRadius, Spacing } from '@/constants/theme'

export function MediaCard({ item, onPress, width = 120 }: { item: MediaItem; onPress: () => void; width?: number }) {
  const colors = DarkPalette
  const uri = posterUrl(item.poster_path)
  const title = titleOf(item)
  return (
    <Pressable onPress={onPress} style={{ width, marginRight: Spacing.sm }}>
      <View style={[styles.poster, { width, height: width * 1.5, backgroundColor: colors.surfaceContainer }]}>
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      </View>
      <Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={2}>{title}</Text>
      {typeof item.vote_average === 'number' ? (
        <Text style={[styles.rating, { color: colors.onSurfaceVariant }]}>★ {item.vote_average.toFixed(1)}</Text>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  poster: { borderRadius: BorderRadius.md, overflow: 'hidden' },
  title: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  rating: { fontSize: 11, marginTop: 2 },
})