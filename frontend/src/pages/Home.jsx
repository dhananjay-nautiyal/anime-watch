import { useMemo, useRef, useState, useEffect, memo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { filterAnime, getTrending, getSeasonal, getStreamableBatch } from '../api/anime'
import { getContinueWatching } from '../api/watchHistory'

import HeroSection from '../components/HeroSection'
import ContinueWatching from '../components/ContinueWatching'
import SectionRow from '../components/SectionRow'
import AnimeCard from '../components/AnimeCard'
import TopRated from '../components/TopRated'
import { HeroSkeleton, CardSkeleton } from '../components/Skeleton'
import { useAuth } from '../context/AuthContext'
import { isValidAnime } from '../utils/animeFilter'

const EXCLUDE_GENRES = '15'

const TRENDING_PARAMS = { genresExclude: EXCLUDE_GENRES, orderBy: 'popularity', sort: 'desc', page: 0, size: 25 }
const AIRING_PARAMS = { status: 'airing', genresExclude: EXCLUDE_GENRES, page: 0, size: 20 }
const TOP_RATED_PARAMS = { status: 'complete', genresExclude: EXCLUDE_GENRES, orderBy: 'score', sort: 'desc', page: 0, size: 20 }
const UPCOMING_PARAMS = { status: 'upcoming', genresExclude: EXCLUDE_GENRES, page: 0, size: 20 }
const SEASONAL_PARAMS = { genresExclude: EXCLUDE_GENRES, orderBy: 'popularity', sort: 'desc', page: 0, size: 20 }
const NEW_RELEASES_PARAMS = { genresExclude: EXCLUDE_GENRES, orderBy: 'popularity', sort: 'desc', page: 0, size: 20 }
const COMPLETED_PARAMS = { status: 'complete', genresExclude: EXCLUDE_GENRES, orderBy: 'popularity', sort: 'desc', page: 0, size: 20 }
const POPULAR_WEEK_PARAMS = { genresExclude: EXCLUDE_GENRES, orderBy: 'popularity', sort: 'desc', page: 0, size: 20 }
const MOVIES_PARAMS = { type: 'Movie', genresExclude: EXCLUDE_GENRES, orderBy: 'score', sort: 'desc', page: 0, size: 20 }
const MOST_VIEWED_PARAMS = { genresExclude: EXCLUDE_GENRES, orderBy: 'members', sort: 'desc', page: 0, size: 20 }

const GENRE_GROUPS = [
  { label: 'Action', to: '/browse?genres=action', icon: '⚔️' },
  { label: 'Romance', to: '/browse?genres=romance', icon: '💕' },
  { label: 'Comedy', to: '/browse?genres=comedy', icon: '😂' },
  { label: 'Fantasy', to: '/browse?genres=fantasy', icon: '🗡️' },
  { label: 'Horror', to: '/browse?genres=horror', icon: '👻' },
  { label: 'Sci-Fi', to: '/browse?genres=sci-fi', icon: '🚀' },
  { label: 'Drama', to: '/browse?genres=drama', icon: '🎭' },
  { label: 'Mecha', to: '/browse?genres=mecha', icon: '🤖' },
  { label: 'Sports', to: '/browse?genres=sports', icon: '🏀' },
  { label: 'Thriller', to: '/browse?genres=thriller', icon: '🔪' },
]

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

function SectionLoading({ count = 6 }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-shrink-0 skeleton w-[180px] aspect-[3/4] rounded-xl" />
      ))}
    </div>
  )
}

function GridSection({ title, viewAllLink, items = [], isLoading, count = 6, error, showType = false }) {
  if (isLoading) {
    return (
      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="skeleton h-7 w-48 rounded" />
        </div>
        <CardSkeleton count={count} />
      </section>
    )
  }
  if (error) {
    return (
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white text-xl md:text-2xl font-bold font-display">{title}</h2>
        </div>
        <p className="text-[#9CA3AF] text-sm">Failed to load content</p>
      </section>
    )
  }
  if (!items.length) return null
  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-white text-xl md:text-2xl font-bold font-display">{title}</h2>
        {viewAllLink && (
          <div className="flex items-center gap-3">
            <Link to={viewAllLink} className="text-sm text-[#9CA3AF] hover:text-white transition-colors font-medium">
              View All →
            </Link>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-[14px]">
        {items.slice(0, count).map((anime, i) => (
          <AnimeCard key={`${anime.malId || anime.id}-${i}`} anime={anime} index={i} />
        ))}
      </div>
    </section>
  )
}

function LazySection({ children, placeholder = null }) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect() } },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return <div ref={ref}>{isVisible ? children : placeholder}</div>
}

function GenreQuickLinks() {
  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-white text-xl md:text-2xl font-bold font-display">Browse by Genre</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {GENRE_GROUPS.map(g => (
          <Link
            key={g.label}
            to={g.to}
            className="bg-card/50 backdrop-blur-sm border border-white/[0.04] hover:border-primary/20 flex items-center gap-3 px-4 py-3 rounded-[14px] hover:bg-white/[0.04] transition-all group"
          >
            <span className="text-lg">{g.icon}</span>
            <span className="text-sm text-[#D1D5DB] group-hover:text-white transition-colors font-medium">{g.label}</span>
          </Link>
        ))}
      </div>
    </section>
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
  const completedQuery = useHomeSection('completed', COMPLETED_PARAMS, 20)
  const popularWeekQuery = useHomeSection('popularWeek', POPULAR_WEEK_PARAMS, 20)
  const moviesQuery = useHomeSection('movies', MOVIES_PARAMS, 20)
  const mostViewedQuery = useHomeSection('mostViewed', MOST_VIEWED_PARAMS, 20)

  const trending = trendingQuery.data || []
  const trendingLoading = trendingQuery.isLoading

  const allQueries = useMemo(() => [
    { data: trendingQuery.data, key: ['home', 'trending', TRENDING_PARAMS] },
    { data: airingQuery.data, key: ['home', 'airing', AIRING_PARAMS] },
    { data: topRatedQuery.data, key: ['home', 'topRated', TOP_RATED_PARAMS] },
    { data: upcomingQuery.data, key: ['home', 'upcoming', UPCOMING_PARAMS] },
    { data: seasonalQuery.data, key: ['home', 'seasonal', SEASONAL_PARAMS] },
    { data: newReleasesQuery.data, key: ['home', 'newReleases', NEW_RELEASES_PARAMS] },
    { data: completedQuery.data, key: ['home', 'completed', COMPLETED_PARAMS] },
    { data: popularWeekQuery.data, key: ['home', 'popularWeek', POPULAR_WEEK_PARAMS] },
    { data: moviesQuery.data, key: ['home', 'movies', MOVIES_PARAMS] },
    { data: mostViewedQuery.data, key: ['home', 'mostViewed', MOST_VIEWED_PARAMS] },
  ], [
    trendingQuery.data, airingQuery.data, topRatedQuery.data, upcomingQuery.data,
    seasonalQuery.data, newReleasesQuery.data, completedQuery.data,
    popularWeekQuery.data, moviesQuery.data, mostViewedQuery.data,
  ])

  const allSuccess = allQueries.every(q => q.data !== undefined)

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

  const continueQuery = useQuery({
    queryKey: ['continue-watching'],
    queryFn: ({ signal }) => getContinueWatching(signal),
    enabled: isAuthenticated,
    staleTime: 60000,
    retry: 0,
  })

  return (
    <div className="pb-16">
      {trendingLoading ? <HeroSkeleton /> : <HeroSection items={trending.slice(0, 6)} />}

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-[42px] -mt-16 relative z-10">
        {isAuthenticated && (
          <ContinueWatching items={continueQuery.data || []} isLoading={continueQuery.isLoading} />
        )}

        <SectionRow
          title="Trending Now"
          viewAllLink="/trending"
          items={trending.slice(0, 20)}
          isLoading={trendingLoading}
        />

        <SectionRow
          title="Currently Airing"
          viewAllLink="/seasonal"
          items={airingQuery.data?.slice(0, 20) || []}
          isLoading={airingQuery.isLoading}
        />

        <GridSection
          title="Popular This Week"
          viewAllLink="/trending"
          items={popularWeekQuery.data?.slice(0, 12) || []}
          isLoading={popularWeekQuery.isLoading}
          error={popularWeekQuery.isError}
          count={12}
        />

        {topRatedQuery.isLoading ? (
          <section>
            <div className="flex items-center justify-between mb-5">
              <div className="skeleton h-7 w-48 rounded" />
            </div>
            <CardSkeleton count={6} />
          </section>
        ) : topRatedQuery.isError ? (
          <p className="text-[#9CA3AF] text-sm">Failed to load top rated</p>
        ) : !topRatedQuery.data?.length ? null : (
          <TopRated items={topRatedQuery.data.slice(0, 10)} />
        )}

        <SectionRow
          title="New Releases"
          viewAllLink="/browse"
          items={newReleasesQuery.data?.slice(0, 20) || []}
          isLoading={newReleasesQuery.isLoading}
        />

        <SectionRow
          title="Movies"
          viewAllLink="/browse?genres=&type=Movie"
          items={moviesQuery.data?.slice(0, 20) || []}
          isLoading={moviesQuery.isLoading}
        />

        <LazySection placeholder={<div className="h-[320px]" />}>
          <GridSection
            title="Completed Series"
            viewAllLink="/browse?status=complete"
            items={completedQuery.data?.slice(0, 12) || []}
            isLoading={completedQuery.isLoading}
            error={completedQuery.isError}
            count={12}
          />
        </LazySection>

        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white text-xl md:text-2xl font-bold font-display">Upcoming Anime</h2>
            <Link to="/seasonal" className="text-sm text-[#9CA3AF] hover:text-white transition-colors font-medium">View All</Link>
          </div>
          {upcomingQuery.isLoading ? (
            <SectionLoading count={6} />
          ) : upcomingQuery.isError ? (
            <p className="text-[#9CA3AF] text-sm">Failed to load upcoming</p>
          ) : !upcomingQuery.data?.length ? null : (
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2">
              <div className="flex gap-[14px]" style={{ minWidth: 'max-content' }}>
                {upcomingQuery.data.slice(0, 15).map((anime, i) => (
                  <motion.div
                    key={`${anime.malId || anime.id}-${i}`}
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.4, delay: i * 0.03 }}
                    className="flex-shrink-0 group"
                  >
                    <Link to={anime.slug ? `/anime/${anime.slug}/ep/1` : `/coming-soon/${anime.malId || anime.id}`} className="block">
                      <div className="relative rounded-[14px] overflow-hidden bg-card transition-all duration-500 group-hover:shadow-glow group-hover:shadow-primary/20 group-hover:-translate-y-1.5 group-hover:scale-[1.02]"
                        style={{ width: '190px', height: '270px' }}>
                        <div className="w-full h-full rounded-[14px] overflow-hidden">
                          <img
                            src={anime.imageUrl || anime.images?.jpg?.image_url}
                            alt={anime.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            loading="lazy"
                          />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                        <div className="absolute top-2 right-2 z-10">
                          <span className="bg-cyan-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-lg backdrop-blur-sm">
                            {anime.airDate ? new Date(anime.airDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBA'}
                          </span>
                        </div>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors duration-300" />
                        <div className="absolute inset-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <div className="w-14 h-14 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-glow transform scale-0 group-hover:scale-100 transition-transform duration-300 delay-100">
                            <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/95 via-black/70 to-transparent">
                          <p className="text-white text-xs font-semibold line-clamp-2 drop-shadow-sm">{anime.title}</p>
                          <p className="text-[#9CA3AF] text-[10px] mt-0.5">
                            {anime.episodes ? `${anime.episodes} eps` : '?'}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </section>

        <LazySection placeholder={<div className="h-[320px]" />}>
          <SectionRow
            title="Most Viewed"
            viewAllLink="/browse"
            items={mostViewedQuery.data?.slice(0, 20) || []}
            isLoading={mostViewedQuery.isLoading}
          />
        </LazySection>

        <LazySection placeholder={<div className="h-[320px]" />}>
          <SectionRow
            title="Seasonal Anime"
            viewAllLink="/seasonal"
            items={seasonalQuery.data?.slice(0, 20) || []}
            isLoading={seasonalQuery.isLoading}
          />
        </LazySection>

        <GenreQuickLinks />
      </div>
    </div>
  )
}
