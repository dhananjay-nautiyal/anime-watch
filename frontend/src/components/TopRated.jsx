import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ImageWithFallback from './ImageWithFallback'

function RatedCard({ anime, index }) {
  const rating = anime.score || anime.rating
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
    >
      <Link to={`/anime/${anime.slug || anime.malId}`} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/[0.03] transition-colors group">
        <span className={`text-2xl font-black font-display w-8 flex-shrink-0 text-center ${
          index === 0 ? 'text-primary' : index === 1 ? 'text-secondary' : index === 2 ? 'text-amber-400' : 'text-muted'
        } group-hover:text-primary transition-colors`}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="w-14 h-20 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-white/5">
          <ImageWithFallback src={anime.imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate group-hover:text-primary transition-colors">{anime.title}</p>
          <div className="flex items-center gap-2 text-xs text-muted mt-1">
            <span className="bg-white/10 text-[9px] font-bold px-1.5 py-0.5 rounded border border-white/5">{anime.type || 'TV'}</span>
            <span>•</span>
            <span>{anime.episodes || '?'} eps</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="text-primary text-sm font-bold">{rating || 'N/A'}</span>
        </div>
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
        <Link to="/trending" className="text-sm text-primary hover:text-primary/80 transition-colors">View All →</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
        {items.map((anime, i) => (
          <RatedCard key={anime.malId || anime.id} anime={anime} index={i} />
        ))}
      </div>
    </section>
  )
}
