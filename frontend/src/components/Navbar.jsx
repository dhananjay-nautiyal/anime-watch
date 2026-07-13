import { useState, useRef, useEffect, memo } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logout as logoutApi } from '../api/auth'
import { useSearchAnime } from '../hooks/useWatch'
import { useDebounce } from '../hooks/useDebounce'
import { motion } from 'framer-motion'
import GenreDropdown from './GenreDropdown'
import MobileMenu from './MobileMenu'
import SearchOverlay from './SearchOverlay'

const GENRES = [
  { label: 'Action', path: '/browse?genres=Action' },
  { label: 'Adventure', path: '/browse?genres=Adventure' },
  { label: 'Comedy', path: '/browse?genres=Comedy' },
  { label: 'Drama', path: '/browse?genres=Drama' },
  { label: 'Fantasy', path: '/browse?genres=Fantasy' },
  { label: 'Horror', path: '/browse?genres=Horror' },
  { label: 'Romance', path: '/browse?genres=Romance' },
  { label: 'Sci-Fi', path: '/browse?genres=Sci-Fi' },
  { label: 'Slice of Life', path: '/browse?genres=Slice of Life' },
  { label: 'Sports', path: '/browse?genres=Sports' },
  { label: 'Thriller', path: '/browse?genres=Thriller' },
  { label: 'Mecha', path: '/browse?genres=Mecha' },
]

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Browse', to: '/browse' },
  { label: 'Movies', to: '/browse?type=Movie' },
  { label: 'TV', to: '/browse?type=TV' },
  { label: 'Genres', to: '#', dropdown: true },
  { label: 'Schedule', to: '/schedule' },
  { label: 'Top Airing', to: '/trending' },
  { label: 'Seasonal', to: '/seasonal' },
]

const SEARCH_POPULAR = [
  'Attack on Titan', 'Demon Slayer', 'One Piece', 'Jujutsu Kaisen',
  'Naruto', 'Death Note', 'Fullmetal Alchemist', 'Steins;Gate',
]

const Navbar = memo(function Navbar() {
  const [searchQuery, setSearchQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [genresOpen, setGenresOpen] = useState(false)
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem('aw_recent_searches') || '[]') } catch { return [] }
  })
  const debouncedQuery = useDebounce(searchQuery, 300)
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const inputRef = useRef(null)
  const genresRef = useRef(null)

  const { data: suggestionsData, isLoading: suggestLoading } = useSearchAnime(debouncedQuery.trim(), 0, 8)
  const suggestions = suggestionsData?.data || []

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (searchOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [searchOpen])

  useEffect(() => {
    setShowSuggestions(!!(debouncedQuery.trim() && suggestions?.length > 0))
  }, [debouncedQuery, suggestions])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (genresRef.current && !genresRef.current.contains(e.target)) setGenresOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && searchOpen) setSearchOpen(false)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true) }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen])

  const addRecentSearch = (q) => {
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== q)
      const updated = [q, ...filtered].slice(0, 5)
      try { localStorage.setItem('aw_recent_searches', JSON.stringify(updated)) } catch {}
      return updated
    })
  }

  const handleSearch = (q) => {
    addRecentSearch(q)
    navigate(`/browse?q=${encodeURIComponent(q)}`)
    setSearchQuery('')
    setSearchOpen(false)
  }

  const clearRecentSearches = () => {
    setRecentSearches([])
    try { localStorage.removeItem('aw_recent_searches') } catch {}
  }

  const handleLogout = async () => {
    const rt = localStorage.getItem('refreshToken')
    if (rt) await logoutApi(rt).catch(() => {})
    logout()
    navigate('/')
  }

  const searchResultClicked = (anime) => {
    const q = anime.title
    addRecentSearch(q)
    setSearchQuery('')
    setShowSuggestions(false)
    setSearchOpen(false)
    navigate(`/anime/${anime.slug || anime.malId || anime.id}`)
  }

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    if (path.startsWith('/browse')) {
      if (path === '/browse') return location.pathname === '/browse'
      const type = new URLSearchParams(path.split('?')[1] || '').get('type')
      const currentType = new URLSearchParams(location.search).get('type')
      return type ? currentType === type : location.pathname.startsWith('/browse')
    }
    return location.pathname.startsWith(path)
  }

  return (
    <>
      <motion.header
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 h-[72px] ${
          scrolled
            ? 'bg-body/95 backdrop-blur-xl border-b border-white/[0.04] shadow-lg shadow-black/20'
            : 'bg-gradient-to-b from-black/60 via-black/20 to-transparent'
        }`}
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="w-9 h-9 rounded-[10px] bg-primary flex items-center justify-center group-hover:shadow-glow transition-all duration-300">
              <span className="text-white text-xs font-black tracking-wider">AW</span>
            </div>
            <span className="text-xl font-extrabold text-white font-display tracking-tight hidden xs:block">
              AnimeWatch
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-0.5 ml-10">
            {NAV_LINKS.map(l => {
              if (l.dropdown) {
                return (
                  <GenreDropdown
                    key={l.label}
                    genres={GENRES}
                    genresOpen={genresOpen}
                    setGenresOpen={setGenresOpen}
                    genresRef={genresRef}
                  />
                )
              }
              return (
                <Link
                  key={l.label}
                  to={l.to}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive(l.to)
                      ? 'text-white bg-white/[0.08]'
                      : 'text-[#9CA3AF] hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {l.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setSearchOpen(true)}
              className="text-[#9CA3AF] hover:text-white transition-colors p-2.5 rounded-xl hover:bg-white/[0.06]"
              aria-label="Search (Ctrl+K)"
              title="Search (Ctrl+K)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {isAuthenticated ? (
              <div className="flex items-center gap-1.5">
                <Link to="/watchlist" className="text-[#9CA3AF] hover:text-white transition-colors p-2.5 rounded-xl hover:bg-white/[0.06] hidden sm:block" aria-label="Watchlist">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </Link>
                <Link to="/favorites" className="text-[#9CA3AF] hover:text-white transition-colors p-2.5 rounded-xl hover:bg-white/[0.06] hidden sm:block" aria-label="Favorites">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </Link>
                <Link to="/profile" className="w-[34px] h-[34px] rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold hover:shadow-glow transition-all ml-1">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </Link>
              </div>
            ) : (
              <Link
                to="/login"
                className="bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-xl text-sm font-medium transition-all hover:shadow-glow active:scale-95"
              >
                Sign In
              </Link>
            )}

            <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden text-white p-1.5" aria-label="Toggle menu">
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

        <MobileMenu
          menuOpen={menuOpen}
          navLinks={NAV_LINKS}
          genres={GENRES}
          isAuthenticated={isAuthenticated}
          onLogout={handleLogout}
          onClose={() => setMenuOpen(false)}
        />
      </motion.header>

      <SearchOverlay
        open={searchOpen}
        query={searchQuery}
        setQuery={setSearchQuery}
        suggestions={suggestions}
        suggestLoading={suggestLoading}
        showSuggestions={showSuggestions}
        recentSearches={recentSearches}
        onClearRecent={clearRecentSearches}
        onSearch={handleSearch}
        onResultClick={searchResultClicked}
        inputRef={inputRef}
        onClose={() => setSearchOpen(false)}
        popularSearches={SEARCH_POPULAR}
      />
    </>
  )
})

export default Navbar
