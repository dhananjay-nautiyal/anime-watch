import { memo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ImageWithFallback from './ImageWithFallback'
import { useAuth } from '../context/AuthContext'

const ContinueCard = memo(function ContinueCard({ anime, progress = 0.3 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="flex-shrink-0 group"
    >
      <Link to={`/watch/${anime.malId || anime.id}/1`} className="block">
        <div className="relative rounded-xl overflow-hidden" style={{ width: '260px', height: '146px' }}>
          <ImageWithFallback
            src={anime.imageUrl || anime.images?.jpg?.image_url}
            alt={anime.title}
            className="group-hover:scale-105 transition-transform duration-500"
            aspectRatio=""
            containerClass="w-full h-full"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
          </ImageWithFallback>
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="text-white text-sm font-medium truncate">{anime.title}</p>
            <p className="text-xs text-muted mt-0.5">Episode 1</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
            <div
              className="h-full bg-primary rounded-r transition-all duration-700"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </Link>
    </motion.div>
  )
})

const ContinueWatching = memo(function ContinueWatching({ items = [], isLoading }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return null
  if (isLoading) {
    return (
      <section>
        <div className="skeleton h-7 w-48 rounded mb-5" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 skeleton w-[260px] aspect-video rounded-xl" />
          ))}
        </div>
      </section>
    )
  }

  if (!items.length) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-white text-xl md:text-2xl font-bold font-display">Continue Watching</h2>
      </div>
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2">
        <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
          {items.slice(0, 8).map((anime, i) => (
            <ContinueCard key={`${anime.malId || anime.id}-${i}`} anime={anime} progress={Math.random() * 0.6 + 0.2} />
          ))}
        </div>
      </div>
    </section>
  )
})

export default ContinueWatching
