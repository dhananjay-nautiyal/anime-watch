import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { filterAnime } from '../api/anime'
import { getEpisodes, syncEpisodes } from '../api/anime'
import HeroSection from '../components/HeroSection'
import ContinueWatching from '../components/ContinueWatching'
import SectionRow from '../components/SectionRow'
import AnimeCard from '../components/AnimeCard'
import { HeroSkeleton, CardSkeleton } from '../components/Skeleton'
import { motion } from 'framer-motion'
import { isValidAnime } from '../utils/animeFilter'

const SECTION_SIZES = {
  trending: 25,
  popular: 10,
  airing: 20,
  topRated: 20,
  upcoming: 20,
  seasonal: 20,
}

const VALID_TYPES = 'tv,movie,ova,ona'
const EXCLUDE_GENRES = '15'

const SECTION_FILTERS = {
  trending: { type: VALID_TYPES, genresExclude: EXCLUDE_GENRES, orderBy: 'popularity', sort: 'desc', page: 0, size: SECTION_SIZES.trending },
  airing: { status: 'airing', type: VALID_TYPES, genresExclude: EXCLUDE_GENRES, page: 0, size: SECTION_SIZES.airing },
  topRated: { status: 'complete', type: VALID_TYPES, genresExclude: EXCLUDE_GENRES, orderBy: 'score', sort: 'desc', page: 0, size: SECTION_SIZES.topRated },
  upcoming: { status: 'upcoming', type: VALID_TYPES, genresExclude: EXCLUDE_GENRES, page: 0, size: SECTION_SIZES.upcoming },
  seasonal: { type: VALID_TYPES, genresExclude: EXCLUDE_GENRES, orderBy: 'popularity', sort: 'desc', page: 0, size: SECTION_SIZES.seasonal },
}

async function fetchWithFallback(filters, targetCount, maxPages = 3) {
  const results = []
  const logLabel = Object.entries(filters).map(([k, v]) => `${k}=${v}`).join(', ')

  for (let page = 0; page < maxPages; page++) {
    if (results.length >= targetCount) break
    try {
      const res = await filterAnime({ ...filters, page, size: 50 })
      const items = res.data || []
      if (items.length === 0) break
      for (const item of items) {
        if (results.length >= targetCount) break
        const { valid, reasons } = isValidAnime(item)
        if (valid && !results.some(r => (r.malId || r.id) === (item.malId || item.id))) {
          results.push(item)
        } else if (!valid && import.meta.env.DEV) {
          console.warn(`[Home] Skipped "${item.title}":`, reasons.join(', '))
        }
      }
      const hasMore = res.page < res.totalPages - 1
      if (!hasMore) break
    } catch {
      break
    }
  }

  if (results.length < targetCount && import.meta.env.DEV) {
    console.warn(`[Home] Only got ${results.length}/${targetCount} valid items for: ${logLabel}`)
  }

  return results.slice(0, targetCount)
}

async function checkEpisodes(malId) {
  if (!malId) return false
  try {
    const eps = await getEpisodes(malId)
    if (eps && eps.length > 0) return true
    const synced = await syncEpisodes(malId)
    return synced && synced.length > 0
  } catch {
    return false
  }
}

async function verifySections(sections) {
  const verified = { trending: [], popular: [], airing: [], topRated: [], upcoming: [], seasonal: [] }
  const allItems = []

  for (const [key, items] of Object.entries(sections)) {
    allItems.push(...items.map(item => ({ key, item })))
  }

  if (import.meta.env.DEV) {
    console.log(`[Home] Verifying ${allItems.length} items for stream availability...`)
  }

  const concurrency = 3
  for (let i = 0; i < allItems.length; i += concurrency) {
    const batch = allItems.slice(i, i + concurrency)
    const results = await Promise.allSettled(
      batch.map(({ item }) => checkEpisodes(item.malId || item.id))
    )
    for (let j = 0; j < batch.length; j++) {
      const { key, item } = batch[j]
      const hasEpisodes = results[j].status === 'fulfilled' && results[j].value
      if (hasEpisodes) {
        verified[key].push(item)
      } else if (import.meta.env.DEV) {
        console.warn(`[Home] No stream for "${item.title}" (malId: ${item.malId || item.id})`)
      }
    }
  }

  if (import.meta.env.DEV) {
    console.log('[Home] Verification complete:', Object.fromEntries(
      Object.entries(verified).map(([k, v]) => [k, v.length])
    ))
  }

  return verified
}

export default function Home() {
  const [trending, setTrending] = useState([])
  const [seasonal, setSeasonal] = useState([])
  const [popular, setPopular] = useState([])
  const [topRated, setTopRated] = useState([])
  const [airing, setAiring] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(true)

  const fetchHomeData = useCallback(async (controller) => {
    const signal = controller.signal

    if (import.meta.env.DEV) console.time('[Home] Fetch')

    try {
      const [trendItems, airItems, ratedItems, upItems, seasonItems] = await Promise.all([
        fetchWithFallback(SECTION_FILTERS.trending, SECTION_SIZES.trending),
        fetchWithFallback(SECTION_FILTERS.airing, SECTION_SIZES.airing),
        fetchWithFallback(SECTION_FILTERS.topRated, SECTION_SIZES.topRated),
        fetchWithFallback(SECTION_FILTERS.upcoming, SECTION_SIZES.upcoming),
        fetchWithFallback(SECTION_FILTERS.seasonal, SECTION_SIZES.seasonal),
      ])

      if (signal.aborted) return

      if (import.meta.env.DEV) console.timeEnd('[Home] Fetch')

      const unverified = {
        trending: trendItems,
        popular: trendItems.slice(0, SECTION_SIZES.popular),
        airing: airItems,
        topRated: ratedItems,
        upcoming: upItems,
        seasonal: seasonItems,
      }

      setTrending(unverified.trending)
      setPopular(unverified.popular)
      setAiring(unverified.airing)
      setTopRated(unverified.topRated)
      setUpcoming(unverified.upcoming)
      setSeasonal(unverified.seasonal)
      setLoading(false)

      if (import.meta.env.DEV) console.time('[Home] Verify streams')

      const verified = await verifySections(unverified)

      if (signal.aborted) return

      if (import.meta.env.DEV) console.timeEnd('[Home] Verify streams')

      setTrending(verified.trending)
      setPopular(verified.popular.slice(0, SECTION_SIZES.popular))
      setAiring(verified.airing)
      setTopRated(verified.topRated)
      setUpcoming(verified.upcoming)
      setSeasonal(verified.seasonal)
    } catch {
      if (!signal.aborted) {
        setLoading(false)
      }
    } finally {
      if (!signal.aborted) {
        setVerifying(false)
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchHomeData(controller)
    return () => controller.abort()
  }, [fetchHomeData])

  return (
    <div className="pb-12">
      {loading ? <HeroSkeleton /> : <HeroSection items={trending.slice(0, 6)} />}

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-12 mt-8">
        <ContinueWatching
          items={trending.slice(0, 8)}
          isLoading={loading || verifying}
        />

        <SectionRow
          title="Trending Now"
          viewAllLink="/trending"
          items={trending.slice(0, 12)}
          isLoading={loading || verifying}
        />

        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white text-xl md:text-2xl font-bold font-display">Popular This Week</h2>
            <Link to="/trending" className="text-sm text-primary hover:text-primary/80 transition-colors font-medium">View All</Link>
          </div>
          {loading || verifying ? (
            <CardSkeleton count={6} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {popular.map((anime, i) => (
                <AnimeCard key={`${anime.malId || anime.id}-${i}`} anime={anime} index={i} />
              ))}
            </div>
          )}
        </section>

        <SectionRow
          title="Airing Now"
          viewAllLink="/seasonal"
          items={airing.slice(0, 12)}
          isLoading={loading || verifying}
        />

        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white text-xl md:text-2xl font-bold font-display">Top Rated Anime</h2>
            <Link to="/trending" className="text-sm text-primary hover:text-primary/80 transition-colors font-medium">View All</Link>
          </div>
          {loading || verifying ? (
            <CardSkeleton count={6} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {topRated.slice(0, 10).map((anime, i) => (
                <motion.div
                  key={`${anime.malId || anime.id}-${i}`}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                >
                  <Link to={`/watch/${anime.malId || anime.id}/1`} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/[0.03] transition-colors group">
                    <span className="text-2xl font-black font-display text-muted w-8 flex-shrink-0 group-hover:text-primary transition-colors">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="w-14 h-20 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={anime.imageUrl || anime.images?.jpg?.image_url}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => { e.target.src = '/images/placeholder-anime.jpg' }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate group-hover:text-primary transition-colors">{anime.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted mt-1">
                        <span>{anime.type || 'TV'}</span>
                        <span>•</span>
                        <span>{anime.episodes ? `${anime.episodes} eps` : 'Unknown'}</span>
                      </div>
                    </div>
                    <span className="text-primary text-sm font-bold">{anime.rating || 'N/A'}</span>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        <SectionRow
          title="New Releases"
          viewAllLink="/browse"
          items={seasonal.slice(0, 12)}
          isLoading={loading || verifying}
        />

        <SectionRow
          title="Upcoming Anime"
          viewAllLink="/seasonal"
          items={upcoming.slice(0, 12)}
          isLoading={loading || verifying}
        />
      </div>
    </div>
  )
}
