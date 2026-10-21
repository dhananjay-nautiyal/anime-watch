import { memo } from 'react'
import { Link } from 'react-router-dom'
import ImageWithFallback from './ImageWithFallback'

const TopCard = memo(function TopCard({ anime, rank }) {

  return (
    <Link
      to={`/anime/${anime.slug || anime.malId}`}
      className="top-card-item flex items-center gap-3 px-4 py-3 relative"
    >
      <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-violet-400 via-primary to-cyan-400 ring-1 ring-white/20 text-white font-semibold rounded-lg flex items-center justify-center text-sm shadow-[0_8px_20px_-10px_rgba(139,92,246,0.9)]">
        {String(rank).padStart(2, '0')}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-textMajor text-[1.1rem] font-medium truncate">{anime.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="type-badge !h-4 !text-[0.65rem] leading-4 bg-badgeTv">TV</span>
          <span className="text-xs text-[#cecece]">
            <span className="inline-flex items-center h-[1.4rem] px-1.5 text-[0.8rem] font-medium bg-badgeSub rounded">
              {anime.episodes || '?'} eps
            </span>
          </span>
        </div>
      </div>
      <div className="flex-shrink-0 w-14" style={{ width: '3.5rem' }}>
        <ImageWithFallback
          src={anime.imageUrl}
          alt=""
          className="w-full aspect-[3/4] object-cover"
          containerClass="w-full aspect-[3/4]"
        />
      </div>
    </Link>
  )
})

export default TopCard
