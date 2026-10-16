import React, { useMemo, useState } from 'react'
import { View, Text, ScrollView, Image, Pressable, StyleSheet, Dimensions, Linking } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { getMovieDetails, getTvDetails, titleOf, posterUrl, backdropUrl } from '@/services/tmdb'
import { DarkPalette, Spacing, BorderRadius, Typography } from '@/constants/theme'
import { useWatchlist } from '@/storage/WatchlistProvider'
import { VideoView, useVideoPlayer } from 'expo-video'

const W = Dimensions.get('window').width

export default function DetailsScreen() {
  const params = useLocalSearchParams<{ id: string; type?: string }>()
  const id = Number(params.id)
  const type = params.type === 'tv' ? 'tv' : 'movie'
  const query = useQuery({ queryKey: [type, id], queryFn: () => type === 'tv' ? getTvDetails(id) : getMovieDetails(id) })
  const data = query.data
  const { contains, add, remove } = useWatchlist()
  const [playSample, setPlaySample] = useState(false)

  const trailer = useMemo(() => {
    const videos = data?.videos?.results ?? []
    const yt = videos.find((v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'))
    return yt ? `https://www.youtube.com/watch?v=${yt.key}` : undefined
  }, [data])

  const player = useVideoPlayer(playSample ? 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' : null, (p) => {
    p.loop = false
    if (playSample) p.play()
  })

  const saved = contains(id, type as 'movie' | 'tv')
  const toggleSave = async () => {
    if (saved) remove(id, type as 'movie' | 'tv')
    else add({ id, type: type as 'movie' | 'tv', title: titleOf(data as any), poster_path: data?.poster_path, backdrop_path: data?.backdrop_path })
  }

  if (!data) return <View style={{ flex: 1, backgroundColor: DarkPalette.background, justifyContent: 'center' }}><Text style={{ color: DarkPalette.onSurfaceVariant, textAlign: 'center' }}>Loading…</Text></View>

  const heroUri = backdropUrl(data.backdrop_path) ?? posterUrl(data.poster_path, 'w780')

  return (
    <ScrollView style={{ flex: 1, backgroundColor: DarkPalette.background }} contentContainerStyle={{ paddingBottom: 40 }}>
      {heroUri ? <Image source={{ uri: heroUri }} style={{ width: W, height: W * 0.56 }} /> : null}
      <View style={{ padding: Spacing.md }}>
        <Text style={[Typography.headlineSmall, { color: DarkPalette.onSurface }]}>{titleOf(data)}</Text>
        <Text style={{ color: DarkPalette.onSurfaceVariant, marginTop: 4 }}>{type === 'tv' ? data.first_air_date : data.release_date} • ★ {Number(data.vote_average ?? 0).toFixed(1)}</Text>
        <Text style={{ color: DarkPalette.onSurface, marginTop: Spacing.md, lineHeight: 20 }}>{data.overview}</Text>
        <View style={styles.actions}>
          <Pressable style={styles.primaryBtn} onPress={() => trailer ? Linking.openURL(trailer) : undefined}>
            <Text style={styles.primaryBtnText}>Play Trailer</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={() => setPlaySample((v) => !v)}>
            <Text style={styles.primaryBtnText}>{playSample ? 'Stop Sample' : 'Play Sample Stream'}</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={toggleSave}>
            <Text style={styles.secondaryBtnText}>{saved ? 'Remove from Library' : 'Add to Library'}</Text>
          </Pressable>
        </View>
        {playSample ? (
          <View style={{ height: 220, marginTop: Spacing.md, borderRadius: BorderRadius.lg, overflow: 'hidden' }}>
            <VideoView player={player} style={{ flex: 1 }} nativeControls />
          </View>
        ) : null}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.lg },
  primaryBtn: { backgroundColor: DarkPalette.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  primaryBtnText: { color: DarkPalette.onPrimary, fontWeight: '600' },
  secondaryBtn: { borderWidth: 1, borderColor: DarkPalette.outline, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  secondaryBtnText: { color: DarkPalette.onSurface, fontWeight: '600' },
})