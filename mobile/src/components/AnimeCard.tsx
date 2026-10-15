import { memo, useRef, useEffect, useCallback } from 'react'
import { TouchableOpacity, Text, View, Animated, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useColorScheme } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Palette, DarkPalette, Typography, Spacing, BorderRadius } from '@/constants/theme'

const PLACEHOLDER = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"><rect fill="#e0e0e0" width="200" height="300"/><text x="100" y="150" text-anchor="middle" fill="#aaa" font-size="14">No Image</text></svg>')

export interface AnimeItem {
  malId?: number
  id?: number
  title: string
  slug?: string
  imageUrl?: string
  images?: { jpg?: { image_url?: string; large_image_url?: string } }
  score?: number | string
  rating?: number | string
  episodes?: number
  type?: string
  status?: string
  synopsis?: string
  genres?: Array<{ malId: number; name: string } | string>
}

interface Props {
  anime: AnimeItem
  index?: number
  width?: number
  showScore?: boolean
  showType?: boolean
}

function AnimeCard({ anime, index = 0, width = 140, showScore = true, showType = true }: Props) {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const colors = colorScheme === 'dark' ? DarkPalette : Palette
  const opacity = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(0.92)).current
  const pressScale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 8,
        tension: 60,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  const imageUrl = anime.imageUrl || anime.images?.jpg?.image_url
  const score = typeof anime.score === 'string' ? parseFloat(anime.score) : anime.score
  const isHd = score != null && score >= 7.5

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.95,
      friction: 8,
      tension: 200,
      useNativeDriver: true,
    }).start()
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start()
  }

  const handlePress = useCallback(() => {
    const isUpcoming = anime.status?.toLowerCase().includes('not yet aired') || anime.status?.toLowerCase().includes('upcoming')
    if (isUpcoming) {
      router.push(`/coming-soon/${anime.malId || anime.id}`)
    } else {
      router.push(`/anime/${anime.slug || anime.malId || anime.id}/ep/1`)
    }
  }, [anime, router])

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={`${anime.title}${score ? `, score ${score.toFixed(1)}` : ''}`}
    >
      <Animated.View style={[styles.card, { width, opacity, transform: [{ scale }] }]}>
        <Animated.View style={{ transform: [{ scale: pressScale }] }}>
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: imageUrl }}
              placeholder={PLACEHOLDER}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={250}
              style={[styles.image, { backgroundColor: colors.surfaceVariant }]}
              accessibilityIgnoresInvertColors
            />
            {showScore && score != null && (
              <View style={[styles.scoreBadge, { backgroundColor: isHd ? '#2E7D32' : colors.surfaceContainer }]}>
                <MaterialCommunityIcons name="star" size={10} color={isHd ? '#FFD54F' : '#FFB300'} />
                <Text style={[styles.scoreText, { color: isHd ? '#FFF' : colors.onSurface }]}>
                  {score.toFixed(1)}
                </Text>
              </View>
            )}
            {showType && anime.type && (
              <View style={[styles.typeBadge, { backgroundColor: colors.primaryContainer }]}>
                <Text style={[styles.typeText, { color: colors.onPrimaryContainer }]}>{anime.type}</Text>
              </View>
            )}
            {anime.episodes != null && (
              <View style={[styles.epBadge, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                <Text style={styles.epText}>{anime.episodes} eps</Text>
              </View>
            )}
          </View>
        </Animated.View>
        <Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={2}>
          {anime.title}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  )
}

export default memo(AnimeCard)

const styles = StyleSheet.create({
  card: {
    marginRight: Spacing.sm,
  },
  imageWrapper: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.md,
  },
  scoreBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  scoreText: {
    ...Typography.labelSmall,
    fontSize: 10,
    fontWeight: '700',
  },
  typeBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    ...Typography.labelSmall,
    fontSize: 10,
    fontWeight: '600',
  },
  epBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  epText: {
    ...Typography.labelSmall,
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600',
  },
  title: {
    ...Typography.bodySmall,
    marginTop: Spacing.xs,
    lineHeight: 16,
  },
})
