import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ImageWithFallback from './ImageWithFallback'

const STATE_BADGES = {
  COMING_SOON: {
    label: 'Coming Soon',
    color: 'bg-secondary/20 text-secondary border-secondary/30',
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  AIRING: {
    label: 'Airing',
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    icon: <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />,
  },
  FINISHED: {
    label: 'Finished',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  READY: {
    label: 'Ready',
    color: 'bg-primary/20 text-primary border-primary/30',
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  NOT_RELEASED: {
    label: 'Not Released',
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  UNAVAILABLE: {
    label: 'Unavailable',
    color: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
  },
  AVAILABLE: null,
  UNKNOWN: null,
}

const TYPE_STYLES = {
  TV: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Movie: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  OVA: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  ONA: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Special: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
}

function getState(anime, state) {
  if (state) return state
  if (!anime.status) return 'AVAILABLE'
  const s = anime.status.toLowerCase()
  if (s === 'currently airing' || s === 'airing') return 'AIRING'
  if (s === 'finished airing' || s === 'complete') return 'FINISHED'
  if (s === 'not yet aired' || s === 'upcoming') return 'COMING_SOON'
  return 'AVAILABLE'
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

function StateBadge({ state }) {
  const badge = STATE_BADGES[state]
  if (!badge) return null
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md border backdrop-blur-sm shadow-lg ${badge.color}`}>
      {badge.icon}
      {badge.label}
    </span>
  )
}

export default function AnimeCard({ anime, index = 0, rank, state }) {
  const malId = anime.malId || anime.id
  const imageUrl = anime.imageUrl || anime.images?.jpg?.image_url
  const isHD = anime.rating >= 8.0
  const resolvedState = getState(anime, state)
  const isComingSoon = resolvedState === 'COMING_SOON'
  const isAvailable = resolvedState === 'AVAILABLE'

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
        <div className="relative rounded-xl overflow-hidden bg-surface/50 shadow-card border border-white/[0.03] transition-all duration-500 group-hover:shadow-glow group-hover:shadow-primary/20 group-hover:-translate-y-1 group-hover:scale-[1.02] group-hover:border-primary/20">
          <ImageWithFallback
            src={imageUrl}
            alt={anime.title}
            className="group-hover:scale-110 transition-transform duration-700"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10 z-[5]" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors duration-300 z-10" />

            <div className="absolute inset-0 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3">
              {isAvailable ? (
                <div className="w-14 h-14 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center transform scale-0 group-hover:scale-100 transition-transform duration-300 delay-100 shadow-glow">
                  <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : isComingSoon ? (
                <span className="px-4 py-2 rounded-full bg-secondary/90 backdrop-blur-sm text-white text-xs font-bold shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-300 delay-100">
                  Coming Soon
                </span>
              ) : (
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transform scale-0 group-hover:scale-100 transition-transform duration-300 delay-100 border border-white/30">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
            </div>
          </ImageWithFallback>

          <div className="absolute top-2 left-2 flex flex-col gap-1 z-30">
            <div className="flex items-center gap-1">
              {anime.rating && (
                <span className="bg-black/80 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-lg border border-white/10">
                  <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {anime.rating}
                </span>
              )}
              {rank && (
                <span className="bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-lg border border-white/10">
                  #{rank}
                </span>
              )}
            </div>
            <StateBadge state={resolvedState} />
          </div>

          <div className="absolute top-2 right-2 z-30">
            {isHD && (
              <span className="bg-gradient-to-r from-primary to-primary/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-lg backdrop-blur-sm">
                HD
              </span>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/95 via-black/70 to-transparent z-30">
            <p className="text-white text-xs font-semibold line-clamp-2 drop-shadow-sm leading-tight">
              {anime.title}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {anime.type && <TypeBadge type={anime.type} />}
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
