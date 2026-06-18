import { Link } from 'react-router-dom'
import { proxyImage } from '../api/imageProxy'
import { motion } from 'framer-motion'

function PopularCard({ anime, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, rotateY: 15 }}
      whileInView={{ opacity: 1, rotateY: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="flex-shrink-0 group perspective-[1000px]"
    >
      <Link to={`/anime/${anime.malId}`} className="block">
        <div
          className="relative rounded-xl overflow-hidden transition-all duration-500 group-hover:shadow-glow group-hover:-translate-y-2"
          style={{ width: '200px', height: '300px' }}
        >
          <img
            src={proxyImage(anime.imageUrl) || ''}
            alt={anime.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute top-3 left-3">
            <span className="bg-black/60 backdrop-blur-sm text-primary text-xs font-bold px-2.5 py-1 rounded-lg border border-primary/20">
              #{index + 1}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-400">
            <p className="text-white text-sm font-semibold line-clamp-2 mb-1">{anime.title}</p>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span>{anime.episodes || '?'} eps</span>
              <span>•</span>
              <span className="text-primary">{anime.rating || 'N/A'}</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

export default function PopularThisWeek({ items = [] }) {
  if (!items.length) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-white text-xl md:text-2xl font-bold font-display">Popular This Week</h2>
        <Link to="/trending" className="text-sm text-primary hover:text-primary/80 transition-colors">View All</Link>
      </div>
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2">
        <div className="flex gap-5" style={{ minWidth: 'max-content' }}>
          {items.map((anime, i) => (
            <PopularCard key={anime.malId} anime={anime} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
