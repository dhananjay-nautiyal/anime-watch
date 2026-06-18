import { Link } from 'react-router-dom'

const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

const FOOTER_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Trending', to: '/trending' },
  { label: 'Browse', to: '/browse' },
  { label: 'Seasonal', to: '/seasonal' },
  { label: 'Schedule', to: '/schedule' },
  { label: 'News', to: '/news' },
]

const GENRES = ['Action', 'Romance', 'Comedy', 'Fantasy', 'Horror', 'Drama', 'Sci-Fi', 'Slice of Life']

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-white/5 bg-body">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="text-2xl font-extrabold gradient-text font-display tracking-tight">
              WatchAnime
            </Link>
            <p className="text-sm text-muted mt-3 leading-relaxed max-w-xs">
              Your premium destination for anime streaming. Discover, watch, and track your favorite anime series in stunning quality.
            </p>
            <div className="flex items-center gap-3 mt-4">
              <span className="text-muted text-xs">Powered by</span>
              <span className="text-xs text-link">Jikan API</span>
            </div>
          </div>

          <div>
            <h4 className="text-white text-sm font-semibold mb-4">Browse</h4>
            <div className="space-y-2.5">
              {FOOTER_LINKS.map(l => (
                <Link key={l.label} to={l.to} className="block text-sm text-muted hover:text-white transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-white text-sm font-semibold mb-4">Genres</h4>
            <div className="space-y-2.5">
              {GENRES.slice(0, 6).map(g => (
                <Link key={g} to={`/browse?genres=${g.toLowerCase()}`} className="block text-sm text-muted hover:text-white transition-colors">
                  {g}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-white text-sm font-semibold mb-4">Support</h4>
            <div className="space-y-2.5">
              {['About', 'Contact', 'FAQ', 'Privacy Policy', 'Terms of Service'].map(s => (
                <span key={s} className="block text-sm text-muted hover:text-white transition-colors cursor-pointer">
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-white text-sm font-semibold mb-4">Account</h4>
            <div className="space-y-2.5">
              <Link to="/login" className="block text-sm text-muted hover:text-white transition-colors">Sign In</Link>
              <Link to="/register" className="block text-sm text-muted hover:text-white transition-colors">Register</Link>
              <Link to="/favorites" className="block text-sm text-muted hover:text-white transition-colors">Favorites</Link>
              <Link to="/watchlist" className="block text-sm text-muted hover:text-white transition-colors">Watchlist</Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-white/5">
          <p className="text-muted text-xs">&copy; 2026 WatchAnime. All rights reserved.</p>
          <p className="text-muted text-xs">Data provided by MyAnimeList via Jikan API</p>
          <button onClick={scrollToTop} className="text-muted hover:text-primary transition-colors p-1" aria-label="Scroll to top">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </footer>
  )
}
