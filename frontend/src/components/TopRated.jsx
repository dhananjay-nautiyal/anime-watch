import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ImageWithFallback from './ImageWithFallback'

function RatedCard({ anime, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
    >
      <Link to={`/anime/${anime.malId}`} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/[0.03] transition-colors group">
        <span className="text-2xl font-black font-display text-muted w-8 flex-shrink-0 group-hover:text-primary transition-colors">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="w-14 h-20 rounded-lg overflow-hidden flex-shrink-0">
          <ImageWithFallback src={anime.imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate group-hover:text-primary transition-colors">{anime.title}</p>
          <div className="flex items-center gap-2 text-xs text-muted mt-1">
            <span>TV</span>
            <span>•</span>
            <span>{anime.episodes || '?'} eps</span>
          </div>
        </div>
        <span className="text-primary text-sm font-bold">{anime.rating || 'N/A'}</span>
      </Link>
    </motion.div>
  )
}

export default function TopRated({ items = [] }) {
  if (!items.length) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-white text-xl md:text-2xl font-bold font-display">Top Rated</h2>
        <Link to="/trending" className="text-sm text-primary hover:text-primary/80 transition-colors">View All</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
        {items.map((anime, i) => (
          <RatedCard key={anime.malId} anime={anime} index={i} />
        ))}
      </div>
    </section>
  )
}
