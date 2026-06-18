import { Link } from 'react-router-dom'

export default function MainCard({ anime }) {
  const imageUrl = anime.imageUrl
  const episodes = anime.episodes || '?'
  const score = anime.rating

  return (
    <div className="main-card px-[0.43rem] mb-6 w-[50%] sm:w-[33.333%] md:w-[25%] lg:w-[20%] xl:w-[14.285%]">
      <div className="inner group cursor-pointer">
        <Link to={`/anime/${anime.malId}`} className="block">
          <div className="anime-poster-wrap relative overflow-hidden" style={{ paddingBottom: '67.5%' }}>
            {imageUrl ? (
              <img src={imageUrl} alt={anime.title} className="poster-img" loading="lazy" />
            ) : (
              <div className="absolute inset-0 bg-secondary flex items-center justify-center text-muted">No Img</div>
            )}
            <div className="play-overlay">
              <i>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              </i>
            </div>
            <div className="absolute left-0 top-0 flex gap-1 z-10">
              <span className="type-badge bg-badgeTv">TV</span>
              {score && <span className="type-badge bg-primary">{score}</span>}
            </div>
          </div>
        </Link>
        <div className="mt-1">
          <div className="flex items-center justify-center gap-1 text-center">
            <span className="inline-flex items-center h-[1.4rem] px-1.5 text-[0.8rem] font-medium text-[#cecece] bg-badgeSub rounded">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zm-4 0H9v2h2V9z" clipRule="evenodd" />
              </svg>
              {episodes}
            </span>
            <span className="inline-flex items-center h-[1.4rem] px-1.5 text-[0.8rem] font-medium text-[#cecece] bg-badgeTotal rounded">SUB</span>
          </div>
          <Link to={`/anime/${anime.malId}`}>
            <p className="anime-title text-center text-sm leading-[1.2rem] h-[2.4rem] line-clamp-2 mt-1.5 text-gray hover:text-textMajor transition-colors">
              {anime.title}
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
