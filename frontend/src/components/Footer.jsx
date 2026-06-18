import { Link } from 'react-router-dom'

export default function Footer() {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <footer className="bg-body mt-10">
      <div className="max-w-[1370px] mx-auto px-4">
        <div className="flex justify-center border-b border-secondary pb-4 mb-6">
          <button onClick={scrollToTop} className="text-link hover:text-white transition-colors flex items-center gap-1 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            Back to top
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-4 justify-center mb-6">
          <Link to="/" className="text-gray hover:text-textMajor text-sm transition-colors">Home</Link>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-8">
          <div className="flex items-center gap-3">
            <span className="text-primary font-bold text-xl" style={{ fontWeight: 800 }}>WatchAnime</span>
            <span className="text-muted text-xs">Copyright &copy; 2026. All Rights Reserved</span>
          </div>
          <div className="text-muted text-xs text-center md:text-right">
            <p>This site uses the Jikan API (MyAnimeList) for anime data.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
