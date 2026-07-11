import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ImageWithFallback from './ImageWithFallback'

export default function MainCard({ anime, index = 0 }) {

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: (index % 6) * 0.06 }}
      className="group"
    >
      <Link to={`/anime/${anime.slug || anime.malId}/ep/1`} className="block">
        <div className="relative rounded-xl overflow-hidden bg-surface/50 shadow-card" style={{ paddingBottom: '140%' }}>
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
            <span className="bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
              TV
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
