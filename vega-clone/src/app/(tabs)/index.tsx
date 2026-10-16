import React from 'react'
import { View, Text, ScrollView, Image, StyleSheet, Dimensions, Pressable } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { getTrendingMovies, getTrendingTv, getPopularMovies, backdropUrl, posterUrl, titleOf, type MediaItem } from '@/services/tmdb'
import { DarkPalette, Spacing, BorderRadius, Typography } from '@/constants/theme'
import { MediaCard } from '@/components/MediaCard'

const W = Dimensions.get('window').width

function Rail({ title, data }: { title: string; data?: MediaItem[] }) {
  if (!data?.length) return null
  const router = useRouter()
  return (
    <View style={{ marginBottom: Spacing.lg }}>
      <Text style={[Typography.titleMedium, { color: DarkPalette.onSurface, marginLeft: Spacing.md, marginBottom: Spacing.sm }]}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.md }}>
        {data.map((m) => (
          <MediaCard key={`${m.media_type}-${m.id}`} item={m} onPress={() => router.push({ pathname: '/details/[id]', params: { id: String(m.id), type: m.media_type ?? 'movie' } } as never)} />
        ))}
      </ScrollView>
    </View>
  )
}

export default function HomeScreen() {
  const router = useRouter()
  const movies = useQuery({ queryKey: ['trending-movies'], queryFn: getTrendingMovies })
  const tv = useQuery({ queryKey: ['trending-tv'], queryFn: getTrendingTv })
  const popular = useQuery({ queryKey: ['popular-movies'], queryFn: getPopularMovies })

  const hero = movies.data?.[0]
  const heroUri = hero ? (backdropUrl(hero.backdrop_path) ?? posterUrl(hero.poster_path, 'w780')) : null

  return (
    <ScrollView style={{ flex: 1, backgroundColor: DarkPalette.background }} contentContainerStyle={{ paddingBottom: 80 }}>
      {hero && heroUri ? (
        <Pressable onPress={() => router.push({ pathname: '/details/[id]', params: { id: String(hero.id), type: 'movie' } } as never)}>
          <Image source={{ uri: heroUri }} style={{ width: W, height: W * 0.56 }} />
          <View style={styles.heroOverlay}>
            <Text style={[Typography.headlineSmall, { color: '#fff' }]} numberOfLines={2}>{titleOf(hero)}</Text>
            <Text style={{ color: '#ddd', marginTop: 4 }} numberOfLines={3}>{hero.overview}</Text>
          </View>
        </Pressable>
      ) : null}
      <View style={{ height: Spacing.md }} />
      <Rail title="Trending Movies" data={movies.data} />
      <Rail title="Trending TV Shows" data={tv.data} />
      <Rail title="Popular Movies" data={popular.data} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  heroOverlay: { position: 'absolute', left: Spacing.md, right: Spacing.md, bottom: Spacing.md },
})