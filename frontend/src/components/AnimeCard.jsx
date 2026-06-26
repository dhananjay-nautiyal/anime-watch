import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ImageWithFallback from './ImageWithFallback'

const TYPE_STYLES = {
  TV: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Movie: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  OVA: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  ONA: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Special: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
}

function TypeBadge({ type }) {
  if (!type) return null
  const style = TYPE_STYLES[type] || 'bg-white/10 text-link border-white/10'
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${style}`}>
      {type}
    </span>
  )
}

function StatusDot({ status }) {
  if (status === 'airing') {
    return (
      <span className="flex items-center gap-1 text-[10px] text-secondary">
        <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
        Airing
      </span>
    )
  }
  return null
}

export default function AnimeCard({ anime, index = 0, rank }) {
  const malId = anime.malId || anime.id
  const imageUrl = anime.imageUrl || anime.images?.jpg?.image_url
  const isHD = anime.rating >= 8.0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.4, delay: (index % 8) * 0.05 }}
      className="group"
    >
      <Link to={`/watch/${malId}/1`} className="block">
        <div className="relative rounded-xl overflow-hidden bg-surface/50 shadow-card transition-all duration-300 group-hover:shadow-xl group-hover:shadow-primary/5 group-hover:-translate-y-1">
          <ImageWithFallback
            src={imageUrl}
            alt={anime.title}
            className="group-hover:scale-105 transition-transform duration-500"
          >
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors duration-300" />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center transform scale-0 group-hover:scale-100 transition-transform duration-300 delay-100">
                <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </ImageWithFallback>

          <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
            {anime.rating && (
              <span className="bg-black/80 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-lg">
                <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {anime.rating}
              </span>
            )}
            {rank && (
              <span className="bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-lg">
                #{rank}
              </span>
            )}
          </div>

          <div className="absolute top-2 right-2 z-10">
            {isHD && (
              <span className="bg-gradient-to-r from-primary to-primary/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-lg">
                HD
              </span>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
            <p className="text-white text-xs font-semibold line-clamp-2 drop-shadow-sm leading-tight">
              {anime.title}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {anime.type && <TypeBadge type={anime.type} />}
              {anime.status && <StatusDot status={anime.status} />}
              <span className="text-[10px] text-muted ml-auto">
                {anime.episodes ? `${anime.episodes} eps` : '?'}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
