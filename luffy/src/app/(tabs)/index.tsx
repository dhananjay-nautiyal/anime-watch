import { useCallback, useMemo, useRef, memo } from 'react'
import {
  View, Text, RefreshControl, StyleSheet, FlatList, Dimensions,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useColorScheme } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@anime/auth'
import * as Haptics from 'expo-haptics'
import { getHomePage, getContinueWatching } from '@anime/api'
import { Palette, DarkPalette, Typography, Spacing, BorderRadius } from '@/constants/theme'
import AnimeCard from '@/components/AnimeCard'
import type { AnimeItem } from '@/components/AnimeCard'
import HeroBanner from '@/components/HeroBanner'
import HomeSkeleton from '@/components/HomeSkeleton'
import PressableScale from '@/components/PressableScale'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.md * 2 - Spacing.sm * 2) / 3
const SECTION_HEADER_H = 44
const HERO_H = SCREEN_WIDTH * 0.56 + 20
const CAROUSEL_H = CARD_WIDTH * 1.33 + 48
const GRID_H = CARD_WIDTH * 1.33 * 2 + 60
const CW_ITEM_W = 150
const CW_ITEM_H = 136

interface HomeData {
  trending?: AnimeItem[]
  airing?: AnimeItem[]
  topRated?: AnimeItem[]
  upcoming?: AnimeItem[]
  seasonal?: AnimeItem[]
  newReleases?: AnimeItem[]
  completed?: AnimeItem[]
  popularWeek?: AnimeItem[]
  movies?: AnimeItem[]
  mostViewed?: AnimeItem[]
  streamableIds?: number[]
}

interface ContinueItem {
  malId: number
  slug?: string
  episodeNumber: number
  animeTitle: string
  animeImage: string
  progressSeconds: number
  durationSeconds: number
}

type Section =
  | { type: 'header' }
  | { type: 'hero' }
  | { type: 'continue-watching'; data: ContinueItem[] }
  | { type: 'carousel'; title: string; data: AnimeItem[]; viewAll?: string }
  | { type: 'grid'; title: string; data: AnimeItem[]; viewAll?: string }

const ContinueCard = memo(function ContinueCard({ item, colors, onPress }: {
  item: ContinueItem
  colors: typeof Palette
  onPress: () => void
}) {
  const progress = item.durationSeconds > 0 ? item.progressSeconds / item.durationSeconds : 0

  return (
    <PressableScale onPress={onPress} haptics hapticType="light" style={styles.continueCard}>
      <View style={[styles.continueImage, { backgroundColor: colors.surfaceVariant }]}>
        <MaterialCommunityIcons name="play-circle" size={32} color="rgba(255,255,255,0.8)" />
      </View>
      <Text style={[styles.continueTitle, { color: colors.onSurface }]} numberOfLines={2}>
        {item.animeTitle}
      </Text>
      <Text style={[styles.continueEp, { color: colors.onSurfaceVariant }]}>EP {item.episodeNumber}</Text>
      <View style={[styles.progressBg, { backgroundColor: colors.surfaceVariant }]}>
        <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: colors.primary }]} />
      </View>
    </PressableScale>
  )
})

function GenreSection({ colors }: { colors: typeof Palette }) {
  const router = useRouter()
  const GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports']

  return (
    <View style={styles.sectionWrapper}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Browse by Genre</Text>
        <PressableScale onPress={() => router.push('/search')} haptics>
          <Text style={[styles.seeAll, { color: colors.primary }]}>All Genres</Text>
        </PressableScale>
      </View>
      <View style={styles.genreGrid}>
        {GENRES.map(g => (
          <PressableScale
            key={g}
            onPress={() => router.push(`/search?genre=${g.toLowerCase()}`)}
            haptics hapticType="selection"
            style={[styles.genreChip, { backgroundColor: colors.secondaryContainer }]}
          >
            <Text style={[styles.genreLabel, { color: colors.onSecondaryContainer }]}>{g}</Text>
          </PressableScale>
        ))}
      </View>
    </View>
  )
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const colorScheme = useColorScheme()
  const colors = colorScheme === 'dark' ? DarkPalette : Palette
  const { isAuthenticated } = useAuth()

  const { data: homeData, isLoading, isRefetching, refetch } = useQuery<HomeData>({
    queryKey: ['home', 'batch'],
    queryFn: ({ signal }) => getHomePage(signal),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  })

  const { data: continueData } = useQuery<ContinueItem[]>({
    queryKey: ['continue-watching'],
    queryFn: ({ signal }) => getContinueWatching(signal),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
    retry: 0,
  })

  const streamableIds = useMemo(() => new Set(homeData?.streamableIds || []), [homeData?.streamableIds])

  const filterStreamable = useCallback(
    (items?: AnimeItem[]) => {
      if (!items) return []
      if (!streamableIds.size || items.length <= 5) return items
      return items.filter(a => streamableIds.has((a.malId || a.id)!))
    },
    [streamableIds],
  )

  const sections = useMemo<Section[]>(() => {
    if (!homeData) return []

    const sections: Section[] = [{ type: 'header' }]

    if (homeData.trending?.length) {
      sections.push({ type: 'hero' })
    }

    if (isAuthenticated && continueData && continueData.length > 0) {
      sections.push({ type: 'continue-watching', data: continueData.slice(0, 10) })
    }

    const trendingFiltered = filterStreamable(homeData.trending)
    if (trendingFiltered.length) {
      sections.push({ type: 'carousel', title: 'Trending Now', data: trendingFiltered.slice(0, 20), viewAll: '/trending' })
    }

    const airingFiltered = filterStreamable(homeData.airing)
    if (airingFiltered.length) {
      sections.push({ type: 'carousel', title: 'Currently Airing', data: airingFiltered.slice(0, 20), viewAll: '/browse?status=airing' })
    }

    const popularFiltered = filterStreamable(homeData.popularWeek)
    if (popularFiltered.length) {
      sections.push({ type: 'grid', title: 'Popular This Week', data: popularFiltered.slice(0, 12), viewAll: '/browse?sort=popularity' })
    }

    const topRatedFiltered = filterStreamable(homeData.topRated)
    if (topRatedFiltered.length) {
      sections.push({ type: 'carousel', title: 'Top Rated', data: topRatedFiltered.slice(0, 20), viewAll: '/browse?sort=score' })
    }

    const newReleasesFiltered = filterStreamable(homeData.newReleases)
    if (newReleasesFiltered.length) {
      sections.push({ type: 'carousel', title: 'New Releases', data: newReleasesFiltered.slice(0, 20), viewAll: '/browse?sort=newest' })
    }

    const moviesFiltered = filterStreamable(homeData.movies)
    if (moviesFiltered.length) {
      sections.push({ type: 'carousel', title: 'Movies', data: moviesFiltered.slice(0, 20), viewAll: '/browse?type=movie' })
    }

    const completedFiltered = filterStreamable(homeData.completed)
    if (completedFiltered.length) {
      sections.push({ type: 'grid', title: 'Completed Series', data: completedFiltered.slice(0, 12), viewAll: '/browse?status=completed' })
    }

    const upcomingFiltered = filterStreamable(homeData.upcoming)
    if (upcomingFiltered.length) {
      sections.push({ type: 'carousel', title: 'Upcoming Anime', data: upcomingFiltered.slice(0, 15), viewAll: '/browse?status=upcoming' })
    }

    const mostViewedFiltered = filterStreamable(homeData.mostViewed)
    if (mostViewedFiltered.length) {
      sections.push({ type: 'carousel', title: 'Most Viewed', data: mostViewedFiltered.slice(0, 20) })
    }

    const seasonalFiltered = filterStreamable(homeData.seasonal)
    if (seasonalFiltered.length) {
      sections.push({ type: 'carousel', title: 'Seasonal Anime', data: seasonalFiltered.slice(0, 20), viewAll: '/seasonal' })
    }

    sections.push({ type: 'carousel', title: 'Browse by Genre', data: [], viewAll: '/search' })

    return sections
  }, [homeData, continueData, isAuthenticated, filterStreamable])

  const carouselGetItemLayout = useCallback(
    (_: any, index: number) => ({
      length: CARD_WIDTH + Spacing.sm,
      offset: (CARD_WIDTH + Spacing.sm) * index,
      index,
    }),
    [],
  )

  const cwGetItemLayout = useCallback(
    (_: any, index: number) => ({
      length: 160,
      offset: 160 * index,
      index,
    }),
    [],
  )

  const renderCarouselItem = useCallback(
    ({ item, index }: { item: AnimeItem; index: number }) => (
      <AnimeCard anime={item} index={index} width={CARD_WIDTH} />
    ),
    [],
  )

  const renderCWItem = useCallback(
    ({ item }: { item: ContinueItem }) => (
      <ContinueCard
        item={item}
        colors={colors}
        onPress={() => router.push(`/anime/${item.slug || item.malId}/ep/${item.episodeNumber}`)}
      />
    ),
    [colors, router],
  )

  const renderSection = useCallback(
    ({ item, index }: { item: Section; index: number }) => {
      switch (item.type) {
        case 'header':
          return (
            <View style={[styles.headerContainer, { paddingTop: insets.top + Spacing.md }]}>
              <Text style={[styles.greeting, { color: colors.onSurfaceVariant }]}>Welcome back</Text>
              <Text style={[styles.appTitle, { color: colors.onSurface }]}>AnimeWatch</Text>
            </View>
          )

        case 'hero':
          return <HeroBanner items={homeData?.trending?.slice(0, 6) || []} />

        case 'continue-watching': {
          const items = item.data
          return (
            <View style={styles.sectionWrapper}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Continue Watching</Text>
                <PressableScale onPress={() => router.push('/continue-watching')} haptics>
                  <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
                </PressableScale>
              </View>
              <FlatList
                data={items}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContent}
                keyExtractor={item => String(item.malId)}
                renderItem={renderCWItem}
                getItemLayout={cwGetItemLayout}
                snapToInterval={160}
                decelerationRate="fast"
                removeClippedSubviews={true}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={3}
              />
            </View>
          )
        }

        case 'carousel': {
          if (item.title === 'Browse by Genre') {
            return <GenreSection colors={colors} />
          }
          return (
            <View style={styles.sectionWrapper}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{item.title}</Text>
                {item.viewAll && (
                  <PressableScale onPress={() => router.push(item.viewAll!)} haptics>
                    <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
                  </PressableScale>
                )}
              </View>
              <FlatList
                data={item.data}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContent}
                keyExtractor={(a, i) => String(a.malId || a.id || i)}
                renderItem={renderCarouselItem}
                getItemLayout={carouselGetItemLayout}
                snapToInterval={CARD_WIDTH + Spacing.sm}
                decelerationRate="fast"
                removeClippedSubviews={true}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={3}
              />
            </View>
          )
        }

        case 'grid':
          return (
            <View style={styles.sectionWrapper}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{item.title}</Text>
                {item.viewAll && (
                  <PressableScale onPress={() => router.push(item.viewAll!)} haptics>
                    <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
                  </PressableScale>
                )}
              </View>
              <View style={styles.gridRow}>
                {item.data.slice(0, 6).map((anime, i) => (
                  <View key={anime.malId || anime.id || i} style={styles.gridItem}>
                    <AnimeCard anime={anime} index={i} width={(SCREEN_WIDTH - Spacing.md * 2 - Spacing.sm) / 2} showType={false} />
                  </View>
                ))}
              </View>
            </View>
          )

        default:
          return null
      }
    },
    [colors, homeData, insets.top, router, renderCWItem, renderCarouselItem, carouselGetItemLayout, cwGetItemLayout],
  )

  const onRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.headerContainer, { paddingTop: insets.top + Spacing.md }]}>
          <Text style={[styles.greeting, { color: colors.onSurfaceVariant }]}>Welcome back</Text>
          <Text style={[styles.appTitle, { color: colors.onSurface }]}>AnimeWatch</Text>
        </View>
        <HomeSkeleton colors={colors} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlashList
        data={sections}
        renderItem={renderSection}
        keyExtractor={(_, i) => String(i)}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xxl }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  greeting: { ...Typography.bodyMedium },
  appTitle: { ...Typography.headlineMedium, fontWeight: '700' },
  sectionWrapper: {
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    height: SECTION_HEADER_H,
  },
  sectionTitle: { ...Typography.titleMedium },
  seeAll: { ...Typography.labelLarge },
  carouselContent: {
    paddingHorizontal: Spacing.md,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  gridItem: {
    width: (SCREEN_WIDTH - Spacing.md * 2 - Spacing.sm) / 2,
  },
  continueCard: {
    width: 150,
    marginRight: Spacing.sm,
  },
  continueImage: {
    width: 150,
    height: 85,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  continueTitle: { ...Typography.bodySmall, lineHeight: 16 },
  continueEp: { ...Typography.labelSmall, marginTop: 2 },
  progressBg: {
    height: 3,
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  genreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  genreChip: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  genreLabel: { ...Typography.labelMedium },
})
