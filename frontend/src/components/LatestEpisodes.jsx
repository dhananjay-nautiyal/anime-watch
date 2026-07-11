import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ImageWithFallback from './ImageWithFallback'

function EpisodeCard({ anime, index }) {

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: (index % 6) * 0.06 }}
      className="group"
    >
      <Link to={`/anime/${anime.slug || anime.malId}/ep/1`} className="block">
        <div className="relative rounded-xl overflow-hidden bg-surface/50" style={{ paddingBottom: '140%' }}>
          <ImageWithFallback
            src={anime.imageUrl}
            alt={anime.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            containerClass="absolute inset-0"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300" />
          <div className="absolute top-2 left-2 flex gap-1 z-10">
            <span className="bg-primary/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
              {anime.rating || 'N/A'}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
            <p className="text-white text-xs font-semibold line-clamp-2">{anime.title}</p>
            <p className="text-[10px] text-muted mt-0.5">{anime.episodes || '?'} Episodes</p>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

export default function LatestEpisodes({ items = [] }) {
  if (!items.length) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-white text-xl md:text-2xl font-bold font-display">Latest Episodes</h2>
        <Link to="/trending" className="text-sm text-primary hover:text-primary/80 transition-colors">View All</Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {items.map((anime, i) => (
          <EpisodeCard key={anime.malId} anime={anime} index={i} />
        ))}
      </div>
    </section>
  )
}
