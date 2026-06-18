import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import ImageWithFallback from './ImageWithFallback'

export default function EpisodeCard({ episode, animeId, animeTitle, isActive, progress }) {
  const location = useLocation()

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Link
        to={`/watch/${animeId}/${episode.episodeNumber}`}
        className={`flex gap-3 p-2.5 rounded-xl transition-all duration-200 group ${
          isActive
            ? 'bg-primary/10 border border-primary/20'
            : 'hover:bg-white/[0.04] border border-transparent'
        }`}
      >
        <div className="relative w-24 h-16 rounded-lg overflow-hidden flex-shrink-0">
          <ImageWithFallback
            src={episode.thumbnail || episode.imageUrl}
            alt={`Episode ${episode.episodeNumber}`}
            className="group-hover:scale-105 transition-transform duration-300"
            aspectRatio=""
            containerClass="w-full h-full"
          />
          {progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
              <div className="h-full bg-primary rounded-r transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          {isActive && (
            <div className="absolute inset-0 ring-2 ring-primary/50 rounded-lg" />
          )}
        </div>
        <div className="flex-1 min-w-0 py-0.5">
          <p className="text-xs text-muted font-medium">EP {episode.episodeNumber}</p>
          <p className="text-sm text-white font-medium truncate">
            {episode.title || `Episode ${episode.episodeNumber}`}
          </p>
          {episode.duration && (
            <p className="text-xs text-muted mt-0.5">{episode.duration}</p>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

export function EpisodeGridCard({ episode, animeId, isActive }) {
  return (
    <Link
      to={`/watch/${animeId}/${episode.episodeNumber}`}
      className={`relative rounded-xl overflow-hidden group transition-all duration-200 ${
        isActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-body' : ''
      }`}
    >
      <div className="aspect-video">
        <ImageWithFallback
          src={episode.thumbnail || episode.imageUrl}
          alt={`Episode ${episode.episodeNumber}`}
          className="group-hover:scale-105 transition-transform duration-300"
          aspectRatio=""
          containerClass="w-full h-full"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex items-end p-3">
        <div>
          <span className="text-[10px] text-primary font-bold">EPISODE {episode.episodeNumber}</span>
          <p className="text-white text-xs font-medium line-clamp-1">{episode.title || `Episode ${episode.episodeNumber}`}</p>
        </div>
      </div>
    </Link>
  )
}
