import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getTrending, getSeasonal, filterAnime, searchAnime } from '../api/anime'
import HeroSection from '../components/HeroSection'
import ContinueWatching from '../components/ContinueWatching'
import SectionRow from '../components/SectionRow'
import AnimeCard from '../components/AnimeCard'
import { HeroSkeleton, CardSkeleton } from '../components/Skeleton'
import { motion } from 'framer-motion'

export default function Home() {
  const [trending, setTrending] = useState([])
  const [seasonal, setSeasonal] = useState([])
  const [popular, setPopular] = useState([])
  const [topRated, setTopRated] = useState([])
  const [airing, setAiring] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getTrending(0, 25).then(r => r.data || []).catch(() => []),
      getSeasonal(0, 20).then(r => r.data.slice(0, 20)).catch(() => []),
      filterAnime({ status: 'airing', page: 0, size: 20 }).then(r => r.data.slice(0, 20)).catch(() => []),
      filterAnime({ status: 'complete', page: 0, size: 20 }).then(r => r.data.slice(0, 20)).catch(() => []),
      filterAnime({ status: 'upcoming', page: 0, size: 20 }).then(r => r.data.slice(0, 20)).catch(() => []),
    ]).then(([trend, season, air, complete, up]) => {
      setTrending(trend)
      setSeasonal(season)
      setPopular(trend.slice(0, 10))
      setAiring(air)
      setTopRated(complete)
      setUpcoming(up)
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="pb-12">
      {loading ? <HeroSkeleton /> : <HeroSection items={trending.slice(0, 6)} />}

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-12 mt-8">
        <ContinueWatching
          items={trending.slice(0, 8)}
          isLoading={loading}
        />

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
              {popular.map((anime, i) => (
                <AnimeCard key={anime.malId || anime.id} anime={anime} index={i} />
              ))}
            </div>
          )}
        </section>

        <SectionRow
          title="Airing Now"
          viewAllLink="/seasonal"
          items={airing.slice(0, 12)}
          isLoading={loading}
        />

        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white text-xl md:text-2xl font-bold font-display">Top Rated Anime</h2>
            <Link to="/trending" className="text-sm text-primary hover:text-primary/80 transition-colors font-medium">View All</Link>
          </div>
          {loading ? (
            <CardSkeleton count={6} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {topRated.slice(0, 10).map((anime, i) => (
                <motion.div
                  key={anime.malId || anime.id}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                >
                  <Link to={`/anime/${anime.malId || anime.id}`} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/[0.03] transition-colors group">
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
          isLoading={loading}
        />

        <SectionRow
          title="Upcoming Anime"
          viewAllLink="/seasonal"
          items={upcoming.slice(0, 12)}
          isLoading={loading}
        />
      </div>
    </div>
  )
}
