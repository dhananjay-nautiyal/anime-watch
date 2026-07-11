import { memo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ImageWithFallback from './ImageWithFallback'

const ContinueCard = memo(function ContinueCard({ item }) {
  const progress = item.durationSeconds > 0 ? item.progressSeconds / item.durationSeconds : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="flex-shrink-0 group"
    >
      <Link to={`/anime/${item.slug || item.malId}/ep/${item.episodeNumber}`} className="block">
        <div className="relative rounded-xl overflow-hidden" style={{ width: '260px', height: '146px' }}>
          <ImageWithFallback
            src={item.animeImage}
            alt={item.animeTitle}
            className="group-hover:scale-105 transition-transform duration-500"
            aspectRatio=""
            containerClass="w-full h-full"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
          </ImageWithFallback>
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="text-white text-sm font-medium truncate">{item.animeTitle}</p>
            <p className="text-xs text-muted mt-0.5">Episode {item.episodeNumber}</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
            <div
              className="h-full bg-primary rounded-r transition-all duration-700"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
        </div>
      </Link>
    </motion.div>
  )
})

const ContinueWatching = memo(function ContinueWatching({ items = [], isLoading }) {
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
          {items.slice(0, 8).map((item, i) => (
            <ContinueCard key={`${item.malId}-${i}`} item={item} />
          ))}
        </div>
      </div>
    </section>
  )
})

export default ContinueWatching
