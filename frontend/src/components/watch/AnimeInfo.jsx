import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import ImageWithFallback from '../ImageWithFallback'

function StatRow({ label, children }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-muted whitespace-nowrap flex-shrink-0 min-w-[80px]">{label}:</span>
      <span className="text-white truncate">{children || 'N/A'}</span>
    </div>
  )
}

function Badge({ children, variant = 'default' }) {
  const variants = {
    default: 'bg-white/10 text-muted',
    primary: 'bg-primary/15 text-primary',
    yellow: 'bg-yellow-500/10 text-yellow-400',
    green: 'bg-green-500/10 text-green-400',
    red: 'bg-red-500/10 text-red-400',
  }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${variants[variant] || variants.default}`}>
      {children}
    </span>
  )
}

export default function AnimeInfo({ anime, episodes = [] }) {
  const genres = useMemo(() => {
    if (!anime?.genres) return []
    return anime.genres.map(g => (typeof g === 'string' ? g : g.name)).filter(Boolean)
  }, [anime?.genres])

  const studios = useMemo(() => {
    if (!anime?.studios) return []
    return anime.studios.map(s => (typeof s === 'string' ? s : s.name)).filter(Boolean)
  }, [anime?.studios])

  const statusVariant = useMemo(() => {
    const s = (anime?.status || '').toLowerCase()
    if (s.includes('airing') || s.includes('ongoing')) return 'green'
    if (s.includes('finished') || s.includes('complete')) return 'primary'
    if (s.includes('upcoming') || s.includes('not')) return 'yellow'
    return 'default'
  }, [anime?.status])

  if (!anime) return null

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
      <div className="flex gap-5">
        <div className="w-28 h-40 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-white/10 hidden sm:block">
          <ImageWithFallback
            src={anime.imageUrl}
            alt={anime.title}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-white text-xl font-bold font-display truncate">{anime.title}</h1>
              {anime.titleJapanese && (
                <p className="text-muted/50 text-xs mt-0.5 truncate">{anime.titleJapanese}</p>
              )}
              {anime.titleEnglish && anime.titleEnglish !== anime.title && (
                <p className="text-muted/30 text-[11px] mt-0.5 truncate">{anime.titleEnglish}</p>
              )}
            </div>
            {anime.score && (
              <div className="flex items-center gap-1 flex-shrink-0 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-2.5 py-1">
                <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-yellow-400 text-xs font-bold">{anime.score}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {anime.type && <Badge variant="primary">{anime.type}</Badge>}
            {anime.status && <Badge variant={statusVariant}>{anime.status}</Badge>}
            {anime.rating && <Badge>{anime.rating}</Badge>}
            {anime.season && anime.year && (
              <Badge>{anime.season} {anime.year}</Badge>
            )}
            {anime.source && <Badge>{anime.source}</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mt-4 text-xs">
            <StatRow label="Type">{anime.type || 'TV'}</StatRow>
            <StatRow label="Episodes">{String(episodes.length || anime.episodes || '?')}</StatRow>
            <StatRow label="Status">{anime.status || 'Unknown'}</StatRow>
            <StatRow label="Duration">{anime.duration || 'Unknown'}</StatRow>
            <StatRow label="Aired">{anime.aired || 'Unknown'}</StatRow>
            <StatRow label="Score">{anime.score ? `${anime.score}/10` : 'N/A'}</StatRow>
            <StatRow label="Season">{anime.season ? `${anime.season} ${anime.year || ''}` : 'N/A'}</StatRow>
            <StatRow label="Source">{anime.source || 'N/A'}</StatRow>
            <StatRow label="Studios">{studios.join(', ') || 'N/A'}</StatRow>
            <StatRow label="Popularity">{anime.popularity ? `#${anime.popularity}` : 'N/A'}</StatRow>
            <StatRow label="Members">{anime.members?.toLocaleString() || 'N/A'}</StatRow>
            <StatRow label="Favorites">{anime.favorites?.toLocaleString() || 'N/A'}</StatRow>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            {anime.malId && (
              <a
                href={`https://myanimelist.net/anime/${anime.malId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-link hover:text-primary bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/30 px-3 py-1 rounded-full transition-all duration-300 flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>
                MAL
              </a>
            )}
            {anime.malId && (
              <a
                href={`https://anilist.co/anime/${anime.malId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-link hover:text-primary bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/30 px-3 py-1 rounded-full transition-all duration-300 flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>
                AniList
              </a>
            )}
          </div>

          {genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {genres.map((genre) => (
                <Link
                  key={genre}
                  to={`/browse?genres=${encodeURIComponent(genre.toLowerCase())}`}
                  className="text-[10px] text-link bg-white/5 hover:bg-primary/20 hover:text-primary border border-white/10 hover:border-primary/30 px-2.5 py-0.5 rounded-full transition-all duration-300"
                >
                  {genre}
                </Link>
              ))}
            </div>
          )}

          {anime.synopsis && (
            <div className="mt-4">
              <p className="text-[11px] text-muted/50 font-semibold uppercase tracking-wider mb-1">Synopsis</p>
              <p className="text-xs text-muted leading-relaxed line-clamp-4">{anime.synopsis}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
