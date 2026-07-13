import { useRef, useEffect, useCallback, useState, memo } from 'react'
import {
  View, Text, TouchableOpacity, FlatList,
  Animated, StyleSheet, Dimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useColorScheme } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Palette, DarkPalette, Typography, Spacing, BorderRadius } from '@/constants/theme'
import type { AnimeItem } from './AnimeCard'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const BANNER_HEIGHT = SCREEN_WIDTH * 0.56
const AUTO_SCROLL_INTERVAL = 5000

interface Props {
  items: AnimeItem[]
}

function HeroBanner({ items }: Props) {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const colors = colorScheme === 'dark' ? DarkPalette : Palette
  const listRef = useRef<FlatList>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const dotAnims = useRef(items.map(() => new Animated.Value(0))).current

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)
    if (idx !== activeIndex) {
      setActiveIndex(idx)
    }
  }, [activeIndex])

  const onMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)
    setActiveIndex(idx)
    Haptics.selectionAsync()
  }, [])

  useEffect(() => {
    dotAnims.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: i === activeIndex ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }).start()
    })
  }, [activeIndex, dotAnims])

  useEffect(() => {
    if (items.length <= 1) return
    const timer = setInterval(() => {
      const next = (activeIndex + 1) % items.length
      listRef.current?.scrollToOffset({ offset: next * SCREEN_WIDTH, animated: true })
      setActiveIndex(next)
    }, AUTO_SCROLL_INTERVAL)
    return () => clearInterval(timer)
  }, [activeIndex, items.length])

  const handlePress = useCallback((item: AnimeItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push(`/anime/${item.slug || item.malId || item.id}/ep/1`)
  }, [router])

  const renderItem = useCallback(({ item }: { item: AnimeItem }) => {
    const imageUrl = item.imageUrl || item.images?.jpg?.large_image_url || item.images?.jpg?.image_url
    const score = typeof item.score === 'string' ? parseFloat(item.score) : item.score
    const genres = (item.genres || []).map(g => (typeof g === 'string' ? g : g.name)).filter(Boolean).slice(0, 3)

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => handlePress(item)}
        style={styles.bannerSlide}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}${score ? `, rating ${score.toFixed(1)}` : ''}`}
      >
        <Image
          source={{ uri: imageUrl }}
          style={styles.bannerImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          accessibilityIgnoresInvertColors
        />
        <View style={[styles.overlay, { backgroundColor: colors.background }]}>
          <View style={styles.overlayContent}>
            <Text style={styles.bannerTitle} numberOfLines={2} accessibilityRole="header">{item.title}</Text>
            {score != null && (
              <View style={styles.scoreRow} accessibilityLabel={`Rating ${score.toFixed(1)} out of 10`}>
                <MaterialCommunityIcons name="star" size={16} color="#FFB300" />
                <Text style={styles.scoreValue}>{score.toFixed(1)}</Text>
              </View>
            )}
            {genres.length > 0 && (
              <View style={styles.genreRow} accessibilityLabel={`Genres: ${genres.join(', ')}`}>
                {genres.map((g, i) => (
                  <View key={i} style={[styles.genreChip, { backgroundColor: colors.primaryContainer }]}>
                    <Text style={[styles.genreText, { color: colors.onPrimaryContainer }]}>{g}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    )
  }, [handlePress, colors])

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    [],
  )

  if (!items.length) return null

  return (
    <View style={styles.container} accessibilityLabel="Featured anime banner carousel">
      <FlatList
        ref={listRef}
        data={items}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        keyExtractor={(_, i) => String(i)}
        getItemLayout={getItemLayout}
        removeClippedSubviews={true}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={3}
      />
      <View style={styles.dotsContainer} accessibilityLabel={`Page ${activeIndex + 1} of ${items.length}`}>
        {items.map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: dotAnims[i].interpolate({
                  inputRange: [0, 1],
                  outputRange: [colors.outlineVariant, colors.primary],
                }),
                width: dotAnims[i].interpolate({
                  inputRange: [0, 1],
                  outputRange: [8, 24],
                }),
              },
            ]}
          />
        ))}
      </View>
    </View>
  )
}

export default memo(HeroBanner)

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  bannerSlide: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  overlayContent: {
    gap: Spacing.xs,
  },
  bannerTitle: {
    ...Typography.titleLarge,
    fontWeight: '700',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreValue: {
    ...Typography.labelLarge,
    color: '#FFB300',
    fontWeight: '700',
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  genreChip: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  genreText: {
    ...Typography.labelSmall,
    fontSize: 11,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: -Spacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
})
