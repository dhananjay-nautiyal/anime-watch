import { memo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ImageWithFallback from './ImageWithFallback'

const AnimeCard = memo(function AnimeCard({ anime, index = 0, rank }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.4, delay: (index % 8) * 0.05 }}
      className="group"
    >
      <Link to={`/watch/${anime.malId || anime.id}/1`} className="block">
        <div className="relative rounded-xl overflow-hidden bg-surface/50 shadow-card">
          <ImageWithFallback
            src={anime.imageUrl || anime.images?.jpg?.image_url}
            alt={anime.title}
            className="group-hover:scale-105 transition-transform duration-500"
          >
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300" />
          </ImageWithFallback>
          <div className="absolute top-2 left-2 flex gap-1 z-10">
            {anime.rating && (
              <span className="bg-primary/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-lg">
                {anime.rating}
              </span>
            )}
            {rank && (
              <span className="bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                #{rank}
              </span>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
            <p className="text-white text-xs font-semibold line-clamp-2 drop-shadow-sm">{anime.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-muted">
                {anime.episodes ? `${anime.episodes} Episodes` : 'Unknown'}
              </span>
              {anime.type && (
                <span className="text-[10px] text-muted">• {anime.type}</span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
})

export default AnimeCard
