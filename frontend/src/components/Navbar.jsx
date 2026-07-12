import { useState, useRef, useEffect, memo } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logout as logoutApi } from '../api/auth'
import { useSearchAnime } from '../hooks/useAnimeData'
import { useDebounce } from '../hooks/useDebounce'
import { motion, AnimatePresence } from 'framer-motion'
import ImageWithFallback from './ImageWithFallback'

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
  const [searchFocused, setSearchFocused] = useState(false)
  const debouncedQuery = useDebounce(searchQuery, 300)
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const inputRef = useRef(null)
  const suggestRef = useRef(null)
  const genresRef = useRef(null)
  const searchOverlayRef = useRef(null)

  const { data: suggestionsData, isLoading: suggestLoading } = useSearchAnime(debouncedQuery.trim(), 0, 8)
  const suggestions = suggestionsData?.data || []

  const isWatchPage = location.pathname.startsWith('/watch') || location.pathname.startsWith('/anime/')

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
    if (debouncedQuery.trim() && suggestions?.length > 0) {
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
    }
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
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen])

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      const q = searchQuery.trim()
      addRecentSearch(q)
      navigate(`/browse?q=${encodeURIComponent(q)}`)
      setSearchQuery('')
      setSearchOpen(false)
    }
  }

  const addRecentSearch = (q) => {
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== q)
      const updated = [q, ...filtered].slice(0, 5)
      try { localStorage.setItem('aw_recent_searches', JSON.stringify(updated)) } catch {}
      return updated
    })
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
                  <div key={l.label} ref={genresRef} className="relative">
                    <button
                      onClick={() => setGenresOpen(!genresOpen)}
                      className={`flex items-center gap-1 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        genresOpen
                          ? 'text-white'
                          : 'text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      {l.label}
                      <svg className={`w-3 h-3 transition-transform duration-200 ${genresOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <AnimatePresence>
                      {genresOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.96 }}
                          transition={{ duration: 0.15 }}
                          className="absolute top-full left-0 mt-2 w-52 bg-[#141827]/95 backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-2xl overflow-hidden"
                        >
                          <div className="py-2 max-h-[320px] overflow-y-auto">
                            {GENRES.map(g => (
                              <Link
                                key={g.label}
                                to={g.path}
                                onClick={() => setGenresOpen(false)}
                                className="block px-4 py-2.5 text-sm text-[#9CA3AF] hover:text-white hover:bg-white/[0.04] transition-colors"
                              >
                                {g.label}
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
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

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden border-t border-white/[0.04] bg-body/95 backdrop-blur-xl"
            >
              <div className="px-4 py-4 space-y-3 max-h-[80vh] overflow-y-auto">
                {NAV_LINKS.map(l => (
                  !l.dropdown ? (
                    <Link key={l.label} to={l.to} onClick={() => setMenuOpen(false)} className="block text-sm text-[#D1D5DB] hover:text-white py-1.5">{l.label}</Link>
                  ) : (
                    <div key={l.label}>
                      <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider mb-2 px-1 mt-3 font-semibold">{l.label}</p>
                      <div className="grid grid-cols-2 gap-1">
                        {GENRES.map(g => (
                          <Link key={g.label} to={g.path} onClick={() => setMenuOpen(false)} className="block text-sm text-[#9CA3AF] hover:text-white px-1 py-1.5">
                            {g.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )
                ))}
                <div className="border-t border-white/[0.04] pt-3">
                  {isAuthenticated ? (
                    <>
                      <Link to="/watchlist" onClick={() => setMenuOpen(false)} className="block text-sm text-[#D1D5DB] hover:text-white">Watchlist</Link>
                      <Link to="/favorites" onClick={() => setMenuOpen(false)} className="block text-sm text-[#D1D5DB] hover:text-white">Favorites</Link>
                      <Link to="/profile" onClick={() => setMenuOpen(false)} className="block text-sm text-[#D1D5DB] hover:text-white">Profile</Link>
                      <button onClick={() => { handleLogout(); setMenuOpen(false) }} className="text-sm text-[#9CA3AF] hover:text-primary mt-2">Sign Out</button>
                    </>
                  ) : (
                    <Link to="/login" onClick={() => setMenuOpen(false)} className="text-sm text-primary">Sign In</Link>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Search Overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            ref={searchOverlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] flex flex-col"
          >
            <div className="bg-body/98 backdrop-blur-2xl flex-1 flex flex-col">
              <div className="max-w-4xl mx-auto w-full px-4 pt-20 pb-4">
                <form onSubmit={handleSearch} ref={suggestRef}>
                  <div className="relative group">
                    <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-[#9CA3AF] group-focus-within:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Search anime, genres, years..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => setSearchFocused(true)}
                      onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl py-5 pl-14 pr-14 text-xl text-white placeholder-[#9CA3AF]/40 outline-none focus:border-primary/50 focus:bg-white/[0.06] transition-all duration-300"
                      aria-label="Search anime"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => { setSearchQuery(''); setShowSuggestions(false) }}
                        className="absolute right-5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    {suggestLoading && (
                      <div className="absolute right-14 top-1/2 -translate-y-1/2">
                        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      </div>
                    )}
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 hidden sm:block">
                      <kbd className="px-2 py-1 text-[10px] font-medium text-[#9CA3AF] bg-white/[0.04] rounded border border-white/[0.08]">ESC</kbd>
                    </div>
                  </div>
                </form>
              </div>

              <div className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full px-4 pb-8">
                {showSuggestions && suggestions.length > 0 ? (
                  <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.06]">
                      <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider font-semibold">Suggestions</p>
                    </div>
                    {suggestions.map((anime, i) => (
                      <motion.button
                        key={anime.malId || anime.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        type="button"
                        onClick={() => searchResultClicked(anime)}
                        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left group/item"
                      >
                        <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-white/[0.04]">
                          <ImageWithFallback src={anime.imageUrl || anime.images?.jpg?.image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white font-medium truncate group-hover/item:text-primary transition-colors">{anime.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-[#9CA3AF]">{anime.type || 'TV'}</span>
                            <span className="text-[10px] text-[#9CA3AF]">•</span>
                            <span className="text-[10px] text-[#9CA3AF]">{anime.episodes ? `${anime.episodes} eps` : '?'}</span>
                            {anime.score && (
                              <>
                                <span className="text-[10px] text-[#9CA3AF]">•</span>
                                <span className="text-[10px] text-yellow-400 flex items-center gap-0.5">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                  {anime.score}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <svg className="w-5 h-5 text-[#9CA3AF] opacity-0 group-hover/item:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </motion.button>
                    ))}
                    <button
                      type="button"
                      onClick={handleSearch}
                      className="w-full text-center text-sm text-primary py-3.5 hover:bg-white/[0.03] transition-colors border-t border-white/[0.06] font-medium"
                    >
                      View all results for "{searchQuery}" →
                    </button>
                  </div>
                ) : !searchQuery.trim() ? (
                  <div className="grid md:grid-cols-2 gap-8 mt-4">
                    {recentSearches.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-xs text-[#9CA3AF] uppercase tracking-wider font-semibold">Recent Searches</h3>
                          <button onClick={clearRecentSearches} className="text-[10px] text-[#9CA3AF] hover:text-white transition-colors">Clear</button>
                        </div>
                        <div className="space-y-1">
                          {recentSearches.map((q, i) => (
                            <button
                              key={i}
                              onClick={() => { setSearchQuery(q); setShowSuggestions(true) }}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] text-left text-sm text-[#D1D5DB] hover:text-white transition-all"
                            >
                              <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <h3 className="text-xs text-[#9CA3AF] uppercase tracking-wider font-semibold mb-3">Popular Searches</h3>
                      <div className="flex flex-wrap gap-2">
                        {SEARCH_POPULAR.map(q => (
                          <button
                            key={q}
                            onClick={() => { setSearchQuery(q); navigate(`/browse?q=${encodeURIComponent(q)}`); setSearchOpen(false) }}
                            className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-sm text-[#D1D5DB] hover:text-white transition-all border border-white/[0.06]"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <button
              onClick={() => setSearchOpen(false)}
              className="absolute top-6 right-6 text-[#9CA3AF] hover:text-white p-2 rounded-full hover:bg-white/[0.04] transition-all"
              aria-label="Close search"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
})

export default Navbar
