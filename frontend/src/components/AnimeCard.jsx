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

function getStatus(anime) {
  if (!anime.status) return null
  const s = anime.status.toLowerCase()
  if (s === 'currently airing' || s === 'airing') return { label: 'Airing', color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25' }
  if (s === 'finished airing' || s === 'complete') return { label: 'Finished', color: 'text-blue-400 bg-blue-500/15 border-blue-500/25' }
  if (s === 'not yet aired' || s === 'upcoming') return { label: 'Coming Soon', color: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/25' }
  return null
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

export default function AnimeCard({ anime, index = 0, rank, state, score }) {
  const malId = anime.malId || anime.id
  const imageUrl = anime.imageUrl || anime.images?.jpg?.image_url
  const status = getStatus(anime)
  const rating = score || anime.score || anime.rating
  const displayRating = rating ? parseFloat(rating) : null
  const episodeCount = anime.episodes || 0
  const isHD = displayRating && displayRating >= 7.5
  const isAvailable = !anime.status?.toLowerCase().includes('upcoming') && !anime.status?.toLowerCase().includes('not yet')
  const isComingSoon = anime.status?.toLowerCase().includes('upcoming') || anime.status?.toLowerCase().includes('not yet aired')

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.4, delay: (index % 8) * 0.05 }}
      className="group"
    >
      <Link
        to={isComingSoon ? `/coming-soon/${malId}` : `/anime/${anime.slug || malId}/ep/1`}
        className="block"
      >
        <div className="relative rounded-[14px] overflow-hidden bg-card transition-all duration-500 group-hover:shadow-glow group-hover:shadow-primary/20 group-hover:-translate-y-1.5 group-hover:scale-[1.02]">
          <div className="aspect-[3/4]">
            <ImageWithFallback
              src={imageUrl}
              alt={anime.title}
              className="group-hover:scale-110 transition-transform duration-700"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10 z-[5]" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors duration-300 z-10" />

              <div className="absolute inset-0 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                {isAvailable ? (
                  <div className="w-14 h-14 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-glow transform scale-0 group-hover:scale-100 transition-transform duration-300 delay-100">
                    <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : (
                  <span className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-white text-[11px] font-bold shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-300 delay-100">
                    Coming Soon
                  </span>
                )}
              </div>
            </ImageWithFallback>
          </div>

          <div className="absolute top-2 left-2 z-30">
            {displayRating && (
              <span className="bg-black/80 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-lg">
                <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {displayRating}
              </span>
            )}
          </div>

          <div className="absolute top-2 right-2 z-30 flex flex-col gap-1 items-end">
            {isHD && (
              <span className="bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-lg">
                HD
              </span>
            )}
            {episodeCount > 0 && (
              <span className="bg-black/80 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-lg whitespace-nowrap">
                {episodeCount} eps
              </span>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/95 via-black/70 to-transparent z-30">
            <p className="text-white text-xs font-semibold line-clamp-2 drop-shadow-sm leading-tight">
              {anime.title}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <TypeBadge type={anime.type} />
              {status && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${status.color}`}>
                  {status.label}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
