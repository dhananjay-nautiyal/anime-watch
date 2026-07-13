import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Share,
  TextInput, FlatList, ActivityIndicator, Animated, Alert, Dimensions,
  LayoutAnimation, Platform, UIManager,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useColorScheme } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@anime/auth'
import {
  getAnimeById, getAnimeBySlug, getEpisodes, getReviews, getTrending,
  getFavorites, addFavorite, removeFavorite,
  getWatchlist, addToWatchlist, updateWatchlistStatus, removeFromWatchlist,
  addReview, deleteReview,
} from '@anime/api'
import { Palette, DarkPalette, Typography, Spacing, BorderRadius } from '@/constants/theme'
import AnimeCard from '@/components/AnimeCard'
import type { AnimeItem } from '@/components/AnimeCard'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_W = (SCREEN_WIDTH - Spacing.md * 2 - Spacing.sm * 2) / 3

function CollapsibleSection({ title, defaultOpen = false, children, icon }: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  icon?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setOpen(!open)
  }

  return (
    <View style={cs.wrapper}>
      <TouchableOpacity onPress={toggle} style={cs.header} activeOpacity={0.6}>
        <View style={cs.headerLeft}>
          {icon && <MaterialCommunityIcons name={icon as any} size={18} color="inherit" style={cs.headerIcon} />}
          <Text style={cs.headerTitle}>{title}</Text>
        </View>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="inherit" />
      </TouchableOpacity>
      {open && <View style={cs.content}>{children}</View>}
    </View>
  )
}

function ActionButton({ icon, label, onPress, active, color }: {
  icon: string
  label: string
  onPress: () => void
  active?: boolean
  color?: string
}) {
  return (
    <TouchableOpacity onPress={onPress} style={[ab.btn, active && ab.btnActive]} activeOpacity={0.7}>
      <MaterialCommunityIcons name={icon as any} size={22} color={color || (active ? '#FFF' : undefined)} />
      <Text style={[ab.label, active && { color: '#FFF' }]}>{label}</Text>
    </TouchableOpacity>
  )
}

export default function AnimeDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const colorScheme = useColorScheme()
  const colors = colorScheme === 'dark' ? DarkPalette : Palette
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  const [reviewPage, setReviewPage] = useState(0)
  const [starRating, setStarRating] = useState(5)
  const [comment, setComment] = useState('')
  const [showAllEps, setShowAllEps] = useState(false)

  const bannerAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(bannerAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: false,
    }).start()
  }, [])

  const isNumeric = useMemo(() => /^\d+$/.test(slug || ''), [slug])

  const animeQuery = useQuery({
    queryKey: ['anime', slug],
    queryFn: ({ signal }) =>
      isNumeric ? getAnimeById(Number(slug), signal) : getAnimeBySlug(slug, signal),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const anime = animeQuery.data

  const episodesQuery = useQuery({
    queryKey: ['episodes', anime?.malId],
    queryFn: ({ signal }) => getEpisodes(anime.malId!, signal),
    enabled: !!anime?.malId,
    staleTime: 10 * 60 * 1000,
  })

  const reviewsQuery = useQuery({
    queryKey: ['reviews', anime?.id, reviewPage],
    queryFn: ({ signal }) => getReviews(anime.id!, reviewPage, 10, signal),
    enabled: !!anime?.id,
    staleTime: 5 * 60 * 1000,
  })

  const trendingQuery = useQuery({
    queryKey: ['trending-recs'],
    queryFn: ({ signal }) => getTrending(0, 20, signal),
    staleTime: 5 * 60 * 1000,
    enabled: !!anime?.id,
  })

  const watchlistQuery = useQuery({
    queryKey: ['watchlist'],
    queryFn: ({ signal }) => getWatchlist(signal),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  })

  const favoritesQuery = useQuery({
    queryKey: ['favorites'],
    queryFn: ({ signal }) => getFavorites(signal),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  })

  const isFavorited = useMemo(() => {
    if (!favoritesQuery.data || !anime?.id) return false
    return favoritesQuery.data.some((f: any) => f.anime?.id === anime.id || f.anime?.malId === anime.malId)
  }, [favoritesQuery.data, anime])

  const watchlistEntry = useMemo(() => {
    if (!watchlistQuery.data || !anime?.id) return null
    return (watchlistQuery.data as any[]).find((e: any) => e.anime?.id === anime.id || e.anime?.malId === anime.malId) ?? null
  }, [watchlistQuery.data, anime])

  const recommendations = useMemo(() => {
    if (!trendingQuery.data) return []
    const { data } = trendingQuery.data as { data: AnimeItem[] }
    return (data || []).filter((a: AnimeItem) => a.malId !== anime?.malId && a.id !== anime?.id).slice(0, 15)
  }, [trendingQuery.data, anime])

  const episodes = useMemo(() => {
    if (!episodesQuery.data) return []
    const sorted = [...episodesQuery.data].sort((a: any, b: any) => (a.episodeNumber || 0) - (b.episodeNumber || 0))
    const seen = new Set<number>()
    const deduped = sorted.filter((e: any) => {
      const key = e.episodeNumber
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return showAllEps ? deduped : deduped.slice(0, 12)
  }, [episodesQuery.data, showAllEps])

  const reviews = reviewsQuery.data?.content || []
  const reviewTotalPages = reviewsQuery.data?.totalPages || 1

  const genres = useMemo(() => {
    if (!anime?.genres) return []
    return anime.genres.map((g: any) => (typeof g === 'string' ? g : g.name)).filter(Boolean)
  }, [anime?.genres])

  const infoRows = useMemo(() => {
    if (!anime) return []
    return [
      ...(anime.studios?.length ? [{ label: 'Studios', value: anime.studios.map((s: any) => s.name || s).join(', ') }] : []),
      ...(anime.source ? [{ label: 'Source', value: anime.source }] : []),
      ...(anime.duration ? [{ label: 'Duration', value: anime.duration }] : []),
      ...(anime.rating ? [{ label: 'Rating', value: anime.rating }] : []),
      ...(anime.season && anime.year ? [{ label: 'Season', value: `${anime.season} ${anime.year}` }] : []),
      ...(anime.rank != null ? [{ label: 'Rank', value: `#${anime.rank}` }] : []),
      ...(anime.popularity != null ? [{ label: 'Popularity', value: `#${anime.popularity}` }] : []),
      ...(anime.episodes != null ? [{ label: 'Episodes', value: String(anime.episodes) }] : []),
      ...(anime.type ? [{ label: 'Type', value: anime.type }] : []),
    ]
  }, [anime])

  const recGetItemLayout = useCallback(
    (_: any, index: number) => ({ length: CARD_W + Spacing.sm, offset: (CARD_W + Spacing.sm) * index, index }),
    [],
  )

  const renderRecItem = useCallback(
    ({ item, index }: { item: any; index: number }) => (
      <AnimeCard anime={item} index={index} width={CARD_W} />
    ),
    [],
  )

  // Mutations
  const favMutation = useMutation({
    mutationFn: () => isFavorited ? removeFavorite(anime!.id!) : addFavorite(anime!.id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
    },
  })

  const handleFavAction = () => {
    if (!anime?.id) return
    Alert.alert(isFavorited ? 'Remove from Favorites?' : 'Add to Favorites?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: () => favMutation.mutate() },
    ])
  }

  const [watchlistLoading, setWatchlistLoading] = useState(false)

  const handleWatchlistAction = useCallback(async (status: string) => {
    if (!anime?.id) return
    setWatchlistLoading(true)
    try {
      if (watchlistEntry?.status === status && watchlistEntry?.id) {
        await removeFromWatchlist(watchlistEntry.id)
      } else if (watchlistEntry?.id) {
        await updateWatchlistStatus(watchlistEntry.id, status)
      } else {
        await addToWatchlist(anime.id, status)
      }
      queryClient.invalidateQueries({ queryKey: ['watchlist'] })
    } catch { }
    setWatchlistLoading(false)
  }, [anime?.id, watchlistEntry, queryClient])

  const handleShare = async () => {
    try {
      await Share.share({
        title: anime?.title || 'Anime',
        url: `https://animewatch.app/anime/${slug}`,
        message: `Check out ${anime?.title} on AnimeWatch!`,
      })
    } catch { }
  }

  const submitReviewMutation = useMutation({
    mutationFn: () => addReview(anime!.id!, starRating, comment.trim()),
    onSuccess: () => {
      setComment('')
      setStarRating(5)
      queryClient.invalidateQueries({ queryKey: ['reviews', anime?.id] })
    },
  })

  const deleteReviewMutation = useMutation({
    mutationFn: (reviewId: number) => deleteReview(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', anime?.id] })
    },
  })

  const renderStars = useCallback((rating: number, setter?: (n: number) => void, size = 28) => {
    return (
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <TouchableOpacity key={n} onPress={setter ? () => setter(n) : undefined} disabled={!setter}>
            <MaterialCommunityIcons
              name={n <= rating ? 'star' : 'star-outline'}
              size={size}
              color={n <= rating ? '#FFB300' : colors.onSurfaceVariant}
            />
          </TouchableOpacity>
        ))}
      </View>
    )
  }, [colors.onSurfaceVariant])

  // Loading state
  if (animeQuery.isLoading) {
    return (
      <View style={[sty.container, { backgroundColor: colors.background }]}>
        <DetailSkeleton colors={colors} />
      </View>
    )
  }

  // Error state
  if (animeQuery.isError || !anime) {
    return (
      <View style={[sty.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={64} color={colors.error} />
        <Text style={[sty.errorTitle, { color: colors.error }]}>Failed to load anime</Text>
        <TouchableOpacity
          style={[sty.retryBtn, { backgroundColor: colors.primary }]}
          onPress={() => animeQuery.refetch()}
        >
          <Text style={[sty.retryText, { color: colors.onPrimary }]}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: Spacing.sm }}>
          <Text style={[sty.retryText, { color: colors.primary }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const bannerImage = anime.imageUrl || anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url
  const posterImage = anime.imageUrl || anime.images?.jpg?.image_url
  const score = typeof anime.score === 'string' ? parseFloat(anime.score) : anime.score
  const animeStatus = anime.status || ''
  const isAiring = /currently airing/i.test(animeStatus)
  const isFinished = /finished/i.test(animeStatus)
  const isUpcoming = /not yet aired|upcoming/i.test(animeStatus)

  return (
    <View style={[sty.container, { backgroundColor: colors.background }]}>
      <View style={[sty.topBar, { paddingTop: insets.top, backgroundColor: 'transparent' }]}>
        <TouchableOpacity onPress={() => router.back()} style={sty.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare} style={sty.backBtn}>
          <MaterialCommunityIcons name="share-variant" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={sty.bannerWrapper}>
          <Image
            source={{ uri: bannerImage }}
            style={sty.bannerImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={300}
          />
          <View style={sty.bannerOverlay} />
        </View>

        {/* Poster + Title Row */}
        <View style={sty.posterRow}>
          <Image
            source={{ uri: posterImage }}
            style={[sty.poster, { borderColor: colors.surface }]}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={250}
          />
          <View style={sty.titleCol}>
            <Text style={[sty.animeTitle, { color: colors.onSurface }]} numberOfLines={3}>
              {anime.title}
            </Text>
            {anime.titleEnglish && anime.titleEnglish !== anime.title && (
              <Text style={[sty.engTitle, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                {anime.titleEnglish}
              </Text>
            )}
            <View style={sty.metaRow}>
              {score != null && (
                <View style={sty.scorePill}>
                  <MaterialCommunityIcons name="star" size={16} color="#FFB300" />
                  <Text style={sty.scoreText}>{score.toFixed(1)}</Text>
                </View>
              )}
              {anime.type && <View style={[sty.typePill, { backgroundColor: colors.secondaryContainer }]}>
                <Text style={[sty.typeText, { color: colors.onSecondaryContainer }]}>{anime.type}</Text>
              </View>}
              {anime.year && <Text style={[sty.yearText, { color: colors.onSurfaceVariant }]}>{anime.year}</Text>}
            </View>
            <View style={sty.statusRow}>
              {isAiring && <View style={[sty.statusDot, { backgroundColor: '#4CAF50' }]} />}
              {isFinished && <View style={[sty.statusDot, { backgroundColor: colors.primary }]} />}
              {isUpcoming && <View style={[sty.statusDot, { backgroundColor: '#FF9800' }]} />}
              <Text style={[sty.statusText, { color: colors.onSurfaceVariant }]}>
                {isAiring ? 'Airing' : isFinished ? 'Finished' : isUpcoming ? 'Upcoming' : animeStatus}
              </Text>
              {anime.episodes != null && (
                <Text style={[sty.statusText, { color: colors.onSurfaceVariant }]}>
                  {' • '}{anime.episodes} {anime.episodes === 1 ? 'ep' : 'eps'}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={sty.actionRow}>
          <ActionButton
            icon={watchlistEntry ? 'bookmark' : 'bookmark-outline'}
            label={watchlistEntry?.status || 'Watchlist'}
            color={colors.onSurface}
            onPress={() => {
              Alert.alert('Watchlist', `Current: ${watchlistEntry?.status || 'None'}`, [
                { text: 'Cancel', style: 'cancel' },
                ...(!watchlistEntry || watchlistEntry.status !== 'WATCHING' ? [{ text: 'Watching', onPress: () => handleWatchlistAction('WATCHING') }] : []),
                ...(!watchlistEntry || watchlistEntry.status !== 'COMPLETED' ? [{ text: 'Completed', onPress: () => handleWatchlistAction('COMPLETED') }] : []),
                ...(!watchlistEntry || watchlistEntry.status !== 'PLAN_TO_WATCH' ? [{ text: 'Plan to Watch', onPress: () => handleWatchlistAction('PLAN_TO_WATCH') }] : []),
                ...(watchlistEntry ? [{ text: 'Remove', style: 'destructive' as const, onPress: () => handleWatchlistAction(watchlistEntry.status) }] : []),
              ])
            }}
            active={!!watchlistEntry}
          />
          <ActionButton
            icon={isFavorited ? 'heart' : 'heart-outline'}
            label={isFavorited ? 'Favorited' : 'Favorite'}
            onPress={handleFavAction}
            active={isFavorited}
            color={isFavorited ? '#E53935' : colors.onSurface}
          />
          <ActionButton icon="share-variant" label="Share" onPress={handleShare} color={colors.onSurface} />
          <ActionButton icon="play-circle" label="Watch" color={colors.primary}
            onPress={() => {
              const epNum = episodes?.[0]?.episodeNumber || 1
              router.push(`/anime/${anime.slug || anime.malId || anime.id}/ep/${epNum}`)
            }}
          />
        </View>

        {/* Genres */}
        {genres.length > 0 && (
          <View style={sty.genresRow}>
            {genres.map((g: string) => (
              <TouchableOpacity key={g} style={[sty.genreChip, { backgroundColor: colors.primaryContainer }]}
                onPress={() => router.push(`/search?genre=${g.toLowerCase()}`)}
              >
                <Text style={[sty.genreText, { color: colors.onPrimaryContainer }]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Collapsible Sections */}
        <View style={sty.sectionsPad}>
          {/* Synopsis */}
          {anime.synopsis && (
            <CollapsibleSection title="Synopsis" defaultOpen icon="text-box-outline">
              <SynopsisText text={anime.synopsis} colors={colors} />
            </CollapsibleSection>
          )}

          {/* Info */}
          {infoRows.length > 0 && (
            <CollapsibleSection title="Information" icon="information-outline">
              <View style={sty.infoGrid}>
                {infoRows.map((row, i) => (
                  <View key={i} style={sty.infoRow}>
                    <Text style={[sty.infoLabel, { color: colors.onSurfaceVariant }]}>{row.label}</Text>
                    <Text style={[sty.infoValue, { color: colors.onSurface }]}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </CollapsibleSection>
          )}

          {/* Episodes */}
          {episodes.length > 0 && (
            <CollapsibleSection title={`Episodes (${episodesQuery.data?.length || 0})`} defaultOpen icon="play-box-multiple-outline">
              <View style={sty.episodesGrid}>
                {episodes.map((ep: any) => (
                  <TouchableOpacity
                    key={ep.id || ep.episodeNumber}
                    style={[sty.epCard, { backgroundColor: colors.surfaceContainerHigh }]}
                    onPress={() => router.push(`/anime/${anime.slug || anime.malId}/ep/${ep.episodeNumber}`)}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{ uri: ep.imageUrl || ep.thumbnail || posterImage }}
                      style={[sty.epThumb, { backgroundColor: colors.surfaceVariant }]}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                    <View style={sty.epInfo}>
                      <Text style={[sty.epNum, { color: colors.primary }]}>EP {ep.episodeNumber}</Text>
                      <Text style={[sty.epTitle, { color: colors.onSurface }]} numberOfLines={1}>
                        {ep.title || `Episode ${ep.episodeNumber}`}
                      </Text>
                      {ep.aired && <Text style={[sty.epDate, { color: colors.onSurfaceVariant }]}>{ep.aired}</Text>}
                    </View>
                    <MaterialCommunityIcons name="play-circle-outline" size={28} color={colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
              {(episodesQuery.data?.length || 0) > 12 && (
                <TouchableOpacity style={sty.showAllBtn} onPress={() => setShowAllEps(!showAllEps)}>
                  <Text style={[sty.showAllText, { color: colors.primary }]}>
                    {showAllEps ? 'Show Less' : `Show All ${episodesQuery.data?.length || 0} Episodes`}
                  </Text>
                </TouchableOpacity>
              )}
            </CollapsibleSection>
          )}

          {/* Reviews */}
          <CollapsibleSection title={`Reviews (${reviewsQuery.data?.totalPages ? '...' : '0'})`} icon="star-outline">
            {/* Review Form */}
            {isAuthenticated && (
              <View style={[sty.reviewForm, { backgroundColor: colors.surfaceContainerHigh, borderRadius: BorderRadius.md }]}>
                <Text style={[sty.reviewFormTitle, { color: colors.onSurface }]}>Write a Review</Text>
                <View style={sty.reviewStarsRow}>
                  {renderStars(starRating, setStarRating)}
                </View>
                <TextInput
                  style={[sty.reviewInput, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholder="Share your thoughts..."
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={[sty.submitBtn, { backgroundColor: colors.primary }, (!comment.trim() || submitReviewMutation.isPending) && { opacity: 0.6 }]}
                  onPress={() => submitReviewMutation.mutate()}
                  disabled={!comment.trim() || submitReviewMutation.isPending}
                >
                  {submitReviewMutation.isPending ? (
                    <ActivityIndicator color={colors.onPrimary} size="small" />
                  ) : (
                    <Text style={[sty.submitText, { color: colors.onPrimary }]}>Submit Review</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Reviews List */}
            {reviews.length === 0 ? (
              <Text style={[sty.emptyText, { color: colors.onSurfaceVariant }]}>No reviews yet.</Text>
            ) : (
              reviews.map((rv: any) => (
                <View key={rv.id} style={[sty.reviewCard, { backgroundColor: colors.surfaceContainerHigh }]}>
                  <View style={sty.reviewHeader}>
                    <View style={sty.reviewUser}>
                      <View style={[sty.reviewAvatar, { backgroundColor: colors.primaryContainer }]}>
                        <MaterialCommunityIcons name="account" size={18} color={colors.onPrimaryContainer} />
                      </View>
                      <View>
                        <Text style={[sty.reviewName, { color: colors.onSurface }]}>
                          {rv.user?.name || 'Anonymous'}
                        </Text>
                        <Text style={[sty.reviewDate, { color: colors.onSurfaceVariant }]}>
                          {rv.createdAt ? new Date(rv.createdAt).toLocaleDateString() : ''}
                        </Text>
                      </View>
                    </View>
                    {rv.user?.id && isAuthenticated && (
                      <TouchableOpacity onPress={() => {
                        Alert.alert('Delete Review?', '', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => deleteReviewMutation.mutate(rv.id) },
                        ])
                      }}>
                        <MaterialCommunityIcons name="delete-outline" size={20} color={colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                  {renderStars(rv.starRating || 0, undefined, 18)}
                  {rv.comment && <Text style={[sty.reviewBody, { color: colors.onSurface }]}>{rv.comment}</Text>}
                </View>
              ))
            )}

            {/* Pagination */}
            {reviewTotalPages > 1 && (
              <View style={sty.paginationRow}>
                <TouchableOpacity
                  style={[sty.pageBtn, { backgroundColor: colors.surfaceContainerHigh }]}
                  onPress={() => setReviewPage(p => Math.max(0, p - 1))}
                  disabled={reviewPage === 0}
                >
                  <Text style={[sty.pageBtnText, { color: reviewPage === 0 ? colors.onSurfaceVariant : colors.primary }]}>Prev</Text>
                </TouchableOpacity>
                <Text style={[sty.pageInfo, { color: colors.onSurfaceVariant }]}>
                  {reviewPage + 1} / {reviewTotalPages}
                </Text>
                <TouchableOpacity
                  style={[sty.pageBtn, { backgroundColor: colors.surfaceContainerHigh }]}
                  onPress={() => setReviewPage(p => Math.min(reviewTotalPages - 1, p + 1))}
                  disabled={reviewPage >= reviewTotalPages - 1}
                >
                  <Text style={[sty.pageBtnText, { color: reviewPage >= reviewTotalPages - 1 ? colors.onSurfaceVariant : colors.primary }]}>Next</Text>
                </TouchableOpacity>
              </View>
            )}
          </CollapsibleSection>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <CollapsibleSection title="You May Also Like" icon="lightbulb-outline">
              <FlatList
                data={recommendations}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: Spacing.xs }}
                keyExtractor={a => String(a.malId || a.id)}
                renderItem={renderRecItem}
                getItemLayout={recGetItemLayout}
                snapToInterval={CARD_W + Spacing.sm}
                decelerationRate="fast"
                removeClippedSubviews={true}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={3}
              />
            </CollapsibleSection>
          )}

          {watchlistLoading && (
            <View style={sty.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
        </View>

        <View style={{ height: insets.bottom + Spacing.xxl }} />
      </ScrollView>
    </View>
  )
}

function SynopsisText({ text, colors }: { text: string; colors: typeof Palette }) {
  const [expanded, setExpanded] = useState(false)
  const short = text.length > 250 ? text.slice(0, 250) + '...' : text

  return (
    <View>
      <Text style={[syno.text, { color: colors.onSurface }]}>{expanded ? text : short}</Text>
      {text.length > 250 && (
        <TouchableOpacity onPress={() => setExpanded(!expanded)}>
          <Text style={[syno.toggle, { color: colors.primary }]}>{expanded ? 'Show Less' : 'Read More'}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

function DetailSkeleton({ colors }: { colors: typeof Palette }) {
  const opacity = useRef(new Animated.Value(0.3)).current
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [])

  const Pulse = ({ style }: { style: any }) => (
    <Animated.View style={[style, { backgroundColor: colors.surfaceVariant, opacity }]} />
  )

  return (
    <ScrollView style={{ flex: 1 }}>
      <Pulse style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.56 }} />
      <View style={{ flexDirection: 'row', padding: Spacing.md, gap: Spacing.sm }}>
        <Pulse style={{ width: 100, height: 150, borderRadius: BorderRadius.md }} />
        <View style={{ flex: 1, gap: 8 }}>
          <Pulse style={{ height: 22, width: '80%', borderRadius: 4 }} />
          <Pulse style={{ height: 16, width: '60%', borderRadius: 4 }} />
          <Pulse style={{ height: 16, width: '40%', borderRadius: 4 }} />
        </View>
      </View>
      <View style={{ padding: Spacing.md, gap: 12 }}>
        <Pulse style={{ height: 16, width: '100%', borderRadius: 4 }} />
        <Pulse style={{ height: 16, width: '100%', borderRadius: 4 }} />
        <Pulse style={{ height: 16, width: '70%', borderRadius: 4 }} />
      </View>
    </ScrollView>
  )
}

const sty = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.56,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  posterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    marginTop: -50,
    gap: Spacing.md,
    alignItems: 'flex-end',
  },
  poster: {
    width: 110,
    height: 165,
    borderRadius: BorderRadius.md,
    borderWidth: 3,
  },
  titleCol: {
    flex: 1,
    paddingBottom: Spacing.xs,
  },
  animeTitle: {
    ...Typography.titleLarge,
    fontWeight: '700',
  },
  engTitle: {
    ...Typography.bodyMedium,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreText: {
    ...Typography.labelLarge,
    fontWeight: '700',
    color: '#FFB300',
  },
  typePill: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeText: { ...Typography.labelSmall, fontWeight: '600' },
  yearText: { ...Typography.bodyMedium },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: { ...Typography.labelMedium },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  genresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  genreChip: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  genreText: { ...Typography.labelSmall, fontSize: 11 },
  sectionsPad: {
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.md,
  },
  infoGrid: {
    gap: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: { ...Typography.bodyMedium, flex: 1 },
  infoValue: { ...Typography.bodyMedium, fontWeight: '500', flex: 2, textAlign: 'right' },
  episodesGrid: {
    gap: Spacing.sm,
  },
  epCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  epThumb: {
    width: 64,
    height: 48,
    borderRadius: BorderRadius.sm,
  },
  epInfo: { flex: 1 },
  epNum: { ...Typography.labelMedium, fontWeight: '700' },
  epTitle: { ...Typography.bodySmall },
  epDate: { ...Typography.labelSmall, marginTop: 2 },
  showAllBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  showAllText: { ...Typography.labelLarge, fontWeight: '600' },
  reviewForm: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  reviewFormTitle: { ...Typography.titleSmall, marginBottom: Spacing.sm },
  reviewStarsRow: {
    marginBottom: Spacing.sm,
  },
  reviewInput: {
    ...Typography.bodyMedium,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    minHeight: 80,
    marginBottom: Spacing.sm,
  },
  submitBtn: {
    borderRadius: BorderRadius.full,
    paddingVertical: 10,
    alignItems: 'center',
  },
  submitText: { ...Typography.labelLarge },
  emptyText: { ...Typography.bodyMedium, textAlign: 'center', paddingVertical: Spacing.lg },
  reviewCard: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  reviewUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewName: { ...Typography.labelLarge },
  reviewDate: { ...Typography.labelSmall },
  reviewBody: { ...Typography.bodyMedium, marginTop: Spacing.xs, lineHeight: 20 },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  pageBtn: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  pageBtnText: { ...Typography.labelMedium, fontWeight: '600' },
  pageInfo: { ...Typography.bodyMedium },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTitle: {
    ...Typography.titleMedium,
    marginTop: Spacing.md,
  },
  retryBtn: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
  },
  retryText: { ...Typography.labelLarge },
})

const cs = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: Spacing.xs,
  },
  headerTitle: {
    ...Typography.titleSmall,
    fontWeight: '600',
  },
  content: {
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
})

const ab = StyleSheet.create({
  btn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  btnActive: {},
  label: {
    ...Typography.labelSmall,
    fontSize: 11,
  },
})

const syno = StyleSheet.create({
  text: {
    ...Typography.bodyMedium,
    lineHeight: 22,
  },
  toggle: {
    ...Typography.labelLarge,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
})
