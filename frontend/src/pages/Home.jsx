import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTrending, useSeasonal, useFilteredAnime } from '../hooks/useAnimeData'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import HeroSection from '../components/HeroSection'
import ContinueWatching from '../components/ContinueWatching'
import SectionRow from '../components/SectionRow'
import AnimeCard from '../components/AnimeCard'
import { HeroSkeleton, CardSkeleton } from '../components/Skeleton'
import { motion } from 'framer-motion'

function LazySection({ children, threshold = 0.1 }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])
  return <div ref={ref}>{visible ? children : <CardSkeleton count={6} />}</div>
}

export default function Home() {
  useDocumentTitle('')

  const { data: trendingData, isLoading: trendingLoading } = useTrending(0, 25)
  const { data: seasonalData, isLoading: seasonalLoading } = useSeasonal(0, 20)
  const [showAiring, setShowAiring] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [showUpcoming, setShowUpcoming] = useState(false)

  const trending = trendingData?.data ?? []
  const seasonal = seasonalData?.data ?? []
  const loading = trendingLoading && seasonalLoading

  return (
    <div className="pb-12">
      {loading ? <HeroSkeleton /> : <HeroSection items={trending.slice(0, 6)} />}

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-12 mt-8">
        <ContinueWatching items={trending.slice(0, 8)} isLoading={loading} />

        <SectionRow
          title="Trending Now"
          viewAllLink="/trending"
          items={trending.slice(0, 12)}
          isLoading={loading}
        />

        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white text-xl md:text-2xl font-bold font-display">Popular This Week</h2>
            <Link to="/trending" className="text-sm text-primary hover:text-primary/80 transition-colors font-medium">View All</Link>
          </div>
          {loading ? (
            <CardSkeleton count={6} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {trending.slice(0, 12).map((anime, i) => (
                <AnimeCard key={`${anime.malId || anime.id}-${i}`} anime={anime} index={i} />
              ))}
            </div>
          )}
        </section>

        <LazySection threshold={0.05}>
          <AiringSection />
        </LazySection>

        <LazySection threshold={0.05}>
          <TopRatedSection />
        </LazySection>

        <SectionRow
          title="New Releases"
          viewAllLink="/browse"
          items={seasonal.slice(0, 12)}
          isLoading={seasonalLoading}
        />

        <LazySection threshold={0.05}>
          <UpcomingSection />
        </LazySection>
      </div>
    </div>
  )
}

function AiringSection() {
  const { data, isLoading } = useFilteredAnime({ status: 'airing', page: 0, size: 20 })
  return (
    <SectionRow
      title="Airing Now"
      viewAllLink="/seasonal"
      items={(data?.data ?? []).slice(0, 12)}
      isLoading={isLoading}
    />
  )
}

function TopRatedSection() {
  const { data, isLoading } = useFilteredAnime({ status: 'complete', page: 0, size: 20 })
  const items = (data?.data ?? []).slice(0, 10)
  if (isLoading) return <CardSkeleton count={6} />
  if (!items.length) return null
  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-white text-xl md:text-2xl font-bold font-display">Top Rated Anime</h2>
        <Link to="/trending" className="text-sm text-primary hover:text-primary/80 transition-colors font-medium">View All</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {items.map((anime, i) => (
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
                  decoding="async"
                  onError={(e) => { e.target.src = '/images/placeholder-anime.svg' }}
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
    </section>
  )
}

function UpcomingSection() {
  const { data, isLoading } = useFilteredAnime({ status: 'upcoming', page: 0, size: 20 })
  return (
    <SectionRow
      title="Upcoming Anime"
      viewAllLink="/seasonal"
      items={(data?.data ?? []).slice(0, 12)}
      isLoading={isLoading}
    />
  )
}
