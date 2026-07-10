import { Link } from 'react-router-dom'
import ImageWithFallback from './ImageWithFallback'

export default function TopCard({ anime, rank }) {

  return (
    <Link
      to={`/anime/${anime.malId}`}
      className="top-card-item flex items-center gap-3 px-4 py-3 relative"
    >
      <div className="flex-shrink-0 w-9 h-9 bg-primary text-white font-medium flex items-center justify-center text-sm">
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
}
