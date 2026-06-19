import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logout as logoutApi } from '../api/auth'
import { motion, AnimatePresence } from 'framer-motion'

export default function Navbar() {
  const [searchQuery, setSearchQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const inputRef = useRef(null)

  const isWatchPage = location.pathname.startsWith('/watch')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (searchOpen && inputRef.current) inputRef.current.focus()
  }, [searchOpen])

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/browse?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
      setSearchOpen(false)
    }
  }

  const handleLogout = async () => {
    const rt = localStorage.getItem('refreshToken')
    if (rt) await logoutApi(rt).catch(() => {})
    logout()
    navigate('/')
  }

  return (
    <motion.header
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || isWatchPage
          ? 'bg-body/95 backdrop-blur-xl border-b border-white/5'
          : 'bg-gradient-to-b from-body/80 to-transparent'
      }`}
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <span className="text-2xl font-extrabold gradient-text font-display tracking-tight">
            WatchAnime
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 ml-8">
          <Link to="/" className={`text-sm font-medium transition-colors ${location.pathname === '/' ? 'text-white' : 'text-muted hover:text-white'}`}>
            Home
          </Link>
          <Link to="/browse" className={`text-sm font-medium transition-colors ${location.pathname === '/browse' ? 'text-white' : 'text-muted hover:text-white'}`}>
            Browse
          </Link>
          <Link to="/trending" className={`text-sm font-medium transition-colors ${location.pathname === '/trending' ? 'text-white' : 'text-muted hover:text-white'}`}>
            Trending
          </Link>
          <Link to="/seasonal" className={`text-sm font-medium transition-colors ${location.pathname === '/seasonal' ? 'text-white' : 'text-muted hover:text-white'}`}>
            Seasonal
          </Link>
          <Link to="/news" className={`text-sm font-medium transition-colors ${location.pathname === '/news' ? 'text-white' : 'text-muted hover:text-white'}`}>
            News
          </Link>
        </nav>

        <div className="flex items-center gap-3 ml-auto">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="text-muted hover:text-white transition-colors p-2"
            aria-label="Toggle search"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link
                to="/watchlist"
                className="text-muted hover:text-white transition-colors p-2 hidden sm:block"
                aria-label="Watchlist"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </Link>
              <Link
                to="/favorites"
                className="text-muted hover:text-white transition-colors p-2 hidden sm:block"
                aria-label="Favorites"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </Link>
              <Link
                to="/profile"
                className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold ring-2 ring-white/10 hover:ring-primary/50 transition-all"
              >
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Link>
            </div>
          ) : (
            <Link
              to="/login"
              className="bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-xl text-sm font-medium transition-all hover:shadow-glow"
            >
              Sign In
            </Link>
          )}

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-white p-1"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="border-t border-white/5 bg-body/95 backdrop-blur-xl"
          >
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
              <form onSubmit={handleSearch}>
                <div className="relative group">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted group-focus-within:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search anime, genres, years..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder-muted/60 outline-none focus:border-primary/50 focus:bg-white/[0.07] transition-all duration-300"
                    aria-label="Search anime"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-white/5 bg-body/95 backdrop-blur-xl"
          >
            <div className="px-4 py-4 space-y-3">
              <Link to="/" onClick={() => setMenuOpen(false)} className="block text-sm text-link hover:text-white">Home</Link>
              <Link to="/browse" onClick={() => setMenuOpen(false)} className="block text-sm text-link hover:text-white">Browse</Link>
              <Link to="/trending" onClick={() => setMenuOpen(false)} className="block text-sm text-link hover:text-white">Trending</Link>
              <Link to="/seasonal" onClick={() => setMenuOpen(false)} className="block text-sm text-link hover:text-white">Seasonal</Link>
              <Link to="/news" onClick={() => setMenuOpen(false)} className="block text-sm text-link hover:text-white">News</Link>
              {isAuthenticated ? (
                <>
                  <Link to="/watchlist" onClick={() => setMenuOpen(false)} className="block text-sm text-link hover:text-white">Watchlist</Link>
                  <Link to="/favorites" onClick={() => setMenuOpen(false)} className="block text-sm text-link hover:text-white">Favorites</Link>
                  <button onClick={() => { handleLogout(); setMenuOpen(false) }} className="text-sm text-muted hover:text-primary">Sign Out</button>
                </>
              ) : (
                <Link to="/login" onClick={() => setMenuOpen(false)} className="block text-sm text-primary">Sign In</Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
