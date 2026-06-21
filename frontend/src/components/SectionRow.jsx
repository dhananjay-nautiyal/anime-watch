import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ImageWithFallback from './ImageWithFallback'

function SectionCard({ anime, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="flex-shrink-0 group"
    >
      <Link to={`/watch/${anime.malId || anime.id}/1`} className="block">
        <div className="relative rounded-xl overflow-hidden" style={{ width: '180px', height: '270px' }}>
          <ImageWithFallback
            src={anime.imageUrl || anime.images?.jpg?.image_url}
            alt={anime.title}
            className="group-hover:scale-105 transition-transform duration-500"
            aspectRatio=""
            containerClass="w-full h-full"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </ImageWithFallback>
          <div className="absolute top-2 left-2 flex gap-1">
            {anime.rating && (
              <span className="bg-primary/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                {anime.rating}
              </span>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 bg-gradient-to-t from-black/80 to-transparent">
            <p className="text-white text-xs font-medium line-clamp-2">{anime.title}</p>
            <p className="text-muted text-[10px] mt-0.5">
              {anime.episodes ? `${anime.episodes} eps` : 'Unknown'}
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

export default function SectionRow({ title, viewAllLink, items = [], isLoading }) {
  if (isLoading) {
    return (
      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="skeleton h-7 w-48 rounded" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 skeleton w-[180px] aspect-[3/4] rounded-xl" />
          ))}
        </div>
      </section>
    )
  }

  if (!items.length) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-white text-xl md:text-2xl font-bold font-display">{title}</h2>
        {viewAllLink && (
          <Link to={viewAllLink} className="text-sm text-primary hover:text-primary/80 transition-colors font-medium">
            View All
          </Link>
        )}
      </div>
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2">
        <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
          {items.map((anime, i) => (
            <SectionCard key={`${anime.malId || anime.id}-${i}`} anime={anime} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
