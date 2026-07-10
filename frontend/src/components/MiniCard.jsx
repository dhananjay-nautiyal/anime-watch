import { Link } from 'react-router-dom'
import ImageWithFallback from './ImageWithFallback'

export default function MiniCard({ anime }) {

  return (
    <div className="flex bg-card hover:bg-cardHover transition-colors" style={{ marginTop: '0.3rem' }}>
      <Link to={`/anime/${anime.malId}`} className="flex-shrink-0" style={{ width: '4.5rem' }}>
        <div className="aspect-[3/4] overflow-hidden">
          <ImageWithFallback
            src={anime.imageUrl}
            alt={anime.title}
            className="w-full h-full object-cover"
          />
        </div>
      </Link>
      <div className="flex-1 ml-3 py-1 overflow-hidden">
        <Link to={`/anime/${anime.malId}`}>
          <p className="text-link hover:text-textMajor transition-colors truncate text-sm">{anime.title}</p>
        </Link>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray">
          <span className="type-badge !h-4 !text-[0.65rem] leading-4 bg-badgeTv">TV</span>
          <span>{anime.episodes || '?'} eps</span>
          <span className="text-muted">{anime.duration || ''}</span>
        </div>
      </div>
    </div>
  )
}
