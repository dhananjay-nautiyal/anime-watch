import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ImageWithFallback from './ImageWithFallback'

function TrendingCard({ anime, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="flex-shrink-0 group"
    >
      <Link to={`/anime/${anime.malId}`} className="block">
        <div className="relative rounded-xl overflow-hidden" style={{ width: '180px', height: '270px' }}>
          <ImageWithFallback
            src={anime.imageUrl}
            alt={anime.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            containerClass="w-full h-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute top-2 left-2 flex gap-1">
            <span className="bg-primary/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
              {anime.rating || 'N/A'}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
            <p className="text-white text-xs font-medium line-clamp-2">{anime.title}</p>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

export default function TrendingSection({ title = 'Trending Now', items = [] }) {
  if (!items.length) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-white text-xl md:text-2xl font-bold font-display">{title}</h2>
        <Link to="/trending" className="text-sm text-primary hover:text-primary/80 transition-colors">View All</Link>
      </div>
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2">
        <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
          {items.map((anime, i) => (
            <TrendingCard key={anime.malId} anime={anime} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
