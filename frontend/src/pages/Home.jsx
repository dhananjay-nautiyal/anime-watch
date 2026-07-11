import { useMemo, useRef, useState, useEffect, memo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { filterAnime, getStreamableBatch } from '../api/anime'
import { getContinueWatching } from '../api/watchHistory'

import HeroSection from '../components/HeroSection'
import ContinueWatching from '../components/ContinueWatching'
import SectionRow from '../components/SectionRow'
import AnimeCard from '../components/AnimeCard'
import TopRated from '../components/TopRated'
import { HeroSkeleton, CardSkeleton } from '../components/Skeleton'
import ImageWithFallback from '../components/ImageWithFallback'
import { useAuth } from '../context/AuthContext'
import { isValidAnime } from '../utils/animeFilter'

const EXCLUDE_GENRES = '15'

const TRENDING_PARAMS = { genresExclude: EXCLUDE_GENRES, orderBy: 'popularity', sort: 'desc', page: 0, size: 25 }
const AIRING_PARAMS = { status: 'airing', genresExclude: EXCLUDE_GENRES, page: 0, size: 20 }
const TOP_RATED_PARAMS = { status: 'complete', genresExclude: EXCLUDE_GENRES, orderBy: 'score', sort: 'desc', page: 0, size: 20 }
const UPCOMING_PARAMS = { status: 'upcoming', genresExclude: EXCLUDE_GENRES, page: 0, size: 20 }
const SEASONAL_PARAMS = { genresExclude: EXCLUDE_GENRES, orderBy: 'popularity', sort: 'desc', page: 0, size: 20 }
const NEW_RELEASES_PARAMS = { genresExclude: EXCLUDE_GENRES, orderBy: 'popularity', sort: 'desc', page: 0, size: 20 }
const MOST_ANTICIPATED_PARAMS = { status: 'upcoming', genresExclude: EXCLUDE_GENRES, orderBy: 'members', sort: 'desc', page: 0, size: 20 }
const RECENTLY_UPDATED_PARAMS = { genresExclude: EXCLUDE_GENRES, orderBy: 'popularity', sort: 'desc', page: 0, size: 20 }

async function fetchWithFallback(filters, targetCount, signal, maxPages = 3) {
  const results = []
  for (let page = 0; page < maxPages; page++) {
    if (results.length >= targetCount) break
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      const res = await filterAnime({ ...filters, page, size: 50 }, signal)
      const items = res.data || []
      if (!items.length) break
      for (const item of items) {
        if (results.length >= targetCount) break
        const { valid } = isValidAnime(item)
        if (valid && !results.some(r => (r.malId || r.id) === (item.malId || item.id))) {
          results.push(item)
        }
      }
      if (res.page >= res.totalPages - 1) break
    } catch (err) {
      if (err.name === 'AbortError') throw err
      break
    }
  }
  return results.slice(0, targetCount)
}

function useHomeSection(key, filters, targetCount) {
  return useQuery({
    queryKey: ['home', key, filters],
    queryFn: ({ signal }) => fetchWithFallback(filters, targetCount, signal),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  })
}

const CountdownBadge = memo(function CountdownBadge({ anime }) {
  const daysLeft = useMemo(() => {
    const dateStr = anime.airDate || anime.startDate || anime.aired?.from
    if (!dateStr) return null
    const target = new Date(dateStr)
    if (isNaN(target.getTime())) return null
    const diff = Math.ceil((target - new Date()) / (1000 * 60 * 60 * 24))
    return diff
  }, [anime])

  if (daysLeft === null) return null

  const colorClass = daysLeft <= 0
    ? 'bg-green-500/90 text-white'
    : daysLeft <= 7
      ? 'bg-red-500/90 text-white animate-pulse'
      : 'bg-primary/90 text-white'

  const label = daysLeft <= 0 ? 'Out Now' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d`

  return (
    <div className="absolute top-2 right-2 z-10">
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-lg ${colorClass}`}>
        {label}
      </span>
    </div>
  )
})

const UpcomingCard = memo(function UpcomingCard({ anime, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="flex-shrink-0 group"
    >
      <Link to={`/anime/${anime.slug || anime.malId || anime.id}`} className="block">
        <div className="relative rounded-xl overflow-hidden" style={{ width: '180px', height: '270px' }}>
          <ImageWithFallback
            src={anime.imageUrl || anime.images?.jpg?.image_url}
            alt={anime.title}
            className="group-hover:scale-105 transition-transform duration-500"
            aspectRatio=""
            containerClass="w-full h-full"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </ImageWithFallback>
          <CountdownBadge anime={anime} />
          <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 bg-gradient-to-t from-black/80 to-transparent">
            <p className="text-white text-xs font-medium line-clamp-2">{anime.title}</p>
            <p className="text-muted text-[10px] mt-0.5">
              {anime.episodes ? `${anime.episodes} eps` : '?'}
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  )
})

function LazySection({ children, placeholder = null }) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref}>
      {isVisible ? children : placeholder}
    </div>
  )
}

function SectionLoading({ count = 6 }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-shrink-0 skeleton w-[180px] aspect-[3/4] rounded-xl" />
      ))}
    </div>
  )
}

export default function Home() {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  const trendingQuery = useHomeSection('trending', TRENDING_PARAMS, 25)
  const airingQuery = useHomeSection('airing', AIRING_PARAMS, 20)
  const topRatedQuery = useHomeSection('topRated', TOP_RATED_PARAMS, 20)
  const upcomingQuery = useHomeSection('upcoming', UPCOMING_PARAMS, 20)
  const seasonalQuery = useHomeSection('seasonal', SEASONAL_PARAMS, 20)
  const newReleasesQuery = useHomeSection('newReleases', NEW_RELEASES_PARAMS, 20)
  const mostAnticipatedQuery = useHomeSection('mostAnticipated', MOST_ANTICIPATED_PARAMS, 20)
  const recentlyUpdatedQuery = useHomeSection('recentlyUpdated', RECENTLY_UPDATED_PARAMS, 20)

  const allQueries = useMemo(() => [
    { data: trendingQuery.data, key: ['home', 'trending', TRENDING_PARAMS] },
    { data: airingQuery.data, key: ['home', 'airing', AIRING_PARAMS] },
    { data: topRatedQuery.data, key: ['home', 'topRated', TOP_RATED_PARAMS] },
    { data: upcomingQuery.data, key: ['home', 'upcoming', UPCOMING_PARAMS] },
    { data: seasonalQuery.data, key: ['home', 'seasonal', SEASONAL_PARAMS] },
    { data: newReleasesQuery.data, key: ['home', 'newReleases', NEW_RELEASES_PARAMS] },
    { data: mostAnticipatedQuery.data, key: ['home', 'mostAnticipated', MOST_ANTICIPATED_PARAMS] },
    { data: recentlyUpdatedQuery.data, key: ['home', 'recentlyUpdated', RECENTLY_UPDATED_PARAMS] },
  ], [
    trendingQuery.data, airingQuery.data, topRatedQuery.data, upcomingQuery.data,
    seasonalQuery.data, newReleasesQuery.data, mostAnticipatedQuery.data, recentlyUpdatedQuery.data,
  ])

  const allSuccess = trendingQuery.isSuccess && airingQuery.isSuccess && topRatedQuery.isSuccess &&
    upcomingQuery.isSuccess && seasonalQuery.isSuccess && newReleasesQuery.isSuccess &&
    mostAnticipatedQuery.isSuccess && recentlyUpdatedQuery.isSuccess

  useEffect(() => {
    if (!allSuccess) return
    const ids = new Set()
    allQueries.forEach(q => q.data?.forEach(a => { const id = a.malId || a.id; if (id) ids.add(id) }))
    if (!ids.size) return
    getStreamableBatch([...ids]).then(streamableIds => {
      if (!streamableIds.length) return
      const filterSet = new Set(streamableIds)
      allQueries.forEach(q => {
        if (q.data) {
          const filtered = q.data.filter(a => filterSet.has(a.malId || a.id))
          if (filtered.length < q.data.length) {
            queryClient.setQueryData(q.key, filtered)
          }
        }
      })
    }).catch(() => {})
  }, [allSuccess, allQueries, queryClient])

  const trending = trendingQuery.data || []
  const trendingLoading = trendingQuery.isLoading

  const continueQuery = useQuery({
    queryKey: ['continue-watching'],
    queryFn: ({ signal }) => getContinueWatching(signal),
    enabled: isAuthenticated,
    staleTime: 60000,
    retry: 0,
  })

  return (
    <div className="pb-12">
      {trendingLoading ? <HeroSkeleton /> : <HeroSection items={trending.slice(0, 6)} />}

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-12 mt-8">
        <ContinueWatching items={continueQuery.data || []} isLoading={continueQuery.isLoading} />

        <SectionRow
          title="Trending Now"
          viewAllLink="/trending"
          items={trending.slice(0, 12)}
          isLoading={trendingLoading}
        />

        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white text-xl md:text-2xl font-bold font-display">Popular This Week</h2>
            <Link to="/trending" className="text-sm text-primary hover:text-primary/80 transition-colors font-medium">View All</Link>
          </div>
          {trendingLoading ? (
            <CardSkeleton count={6} />
          ) : trendingQuery.isError ? (
            <p className="text-muted text-sm">Failed to load trending</p>
          ) : !trending.length ? (
            <p className="text-muted text-sm">No anime available</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {trending.slice(0, 10).map((anime, i) => (
                <AnimeCard key={`${anime.malId || anime.id}-${i}`} anime={anime} index={i} />
              ))}
            </div>
          )}
        </section>

        <SectionRow
          title="Airing Now"
          viewAllLink="/seasonal"
          items={airingQuery.data?.slice(0, 12) || []}
          isLoading={airingQuery.isLoading}
        />

        {topRatedQuery.isLoading ? (
          <section>
            <div className="flex items-center justify-between mb-5">
              <div className="skeleton h-7 w-48 rounded" />
            </div>
            <CardSkeleton count={6} />
          </section>
        ) : topRatedQuery.isError ? (
          <p className="text-muted text-sm">Failed to load top rated</p>
        ) : !topRatedQuery.data?.length ? (
          <p className="text-muted text-sm">No top rated anime</p>
        ) : (
          <TopRated items={topRatedQuery.data.slice(0, 10)} />
        )}

        <SectionRow
          title="New Releases"
          viewAllLink="/browse"
          items={newReleasesQuery.data?.slice(0, 12) || []}
          isLoading={newReleasesQuery.isLoading}
        />

        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white text-xl md:text-2xl font-bold font-display">Upcoming Anime</h2>
            <Link to="/seasonal" className="text-sm text-primary hover:text-primary/80 transition-colors font-medium">View All</Link>
          </div>
          {upcomingQuery.isLoading ? (
            <SectionLoading count={6} />
          ) : upcomingQuery.isError ? (
            <p className="text-muted text-sm">Failed to load upcoming</p>
          ) : !upcomingQuery.data?.length ? (
            <p className="text-muted text-sm">No upcoming anime</p>
          ) : (
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2">
              <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
                {upcomingQuery.data.slice(0, 12).map((anime, i) => (
                  <UpcomingCard key={`${anime.malId || anime.id}-${i}`} anime={anime} index={i} />
                ))}
              </div>
            </div>
          )}
        </section>

        <LazySection placeholder={<div className="h-[300px]" />}>
          <SectionRow
            title="Most Anticipated"
            viewAllLink="/seasonal"
            items={mostAnticipatedQuery.data?.slice(0, 12) || []}
            isLoading={mostAnticipatedQuery.isLoading}
          />
        </LazySection>

        <LazySection placeholder={<div className="h-[300px]" />}>
          <SectionRow
            title="Seasonal"
            viewAllLink="/seasonal"
            items={seasonalQuery.data?.slice(0, 12) || []}
            isLoading={seasonalQuery.isLoading}
          />
        </LazySection>

        <LazySection placeholder={<div className="h-[300px]" />}>
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white text-xl md:text-2xl font-bold font-display">Recently Updated</h2>
              <Link to="/browse" className="text-sm text-primary hover:text-primary/80 transition-colors font-medium">View All</Link>
            </div>
            {recentlyUpdatedQuery.isLoading ? (
              <CardSkeleton count={6} />
            ) : recentlyUpdatedQuery.isError ? (
              <p className="text-muted text-sm">Failed to load updates</p>
            ) : !recentlyUpdatedQuery.data?.length ? (
              <p className="text-muted text-sm">No recent updates</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {recentlyUpdatedQuery.data.slice(0, 12).map((anime, i) => (
                  <AnimeCard key={`${anime.malId || anime.id}-${i}`} anime={anime} index={i} />
                ))}
              </div>
            )}
          </section>
        </LazySection>
      </div>
    </div>
  )
}
