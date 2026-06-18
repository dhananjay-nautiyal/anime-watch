import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logout as logoutApi } from '../api/auth'

const GENRES = [
  { id: 1, name: 'Action' }, { id: 2, name: 'Adventure' }, { id: 3, name: 'Cars' },
  { id: 4, name: 'Comedy' }, { id: 5, name: 'Dementia' }, { id: 6, name: 'Demons' },
  { id: 7, name: 'Mystery' }, { id: 8, name: 'Drama' }, { id: 9, name: 'Ecchi' },
  { id: 10, name: 'Fantasy' }, { id: 11, name: 'Game' }, { id: 12, name: 'Harem' },
  { id: 13, name: 'Historical' }, { id: 14, name: 'Horror' }, { id: 15, name: 'Kids' },
  { id: 16, name: 'Magic' }, { id: 17, name: 'Martial Arts' }, { id: 18, name: 'Mecha' },
  { id: 19, name: 'Music' }, { id: 20, name: 'Parody' }, { id: 21, name: 'Samurai' },
  { id: 22, name: 'Romance' }, { id: 23, name: 'School' }, { id: 24, name: 'Sci-Fi' },
  { id: 25, name: 'Shoujo' }, { id: 26, name: 'Shounen' }, { id: 27, name: 'Space' },
  { id: 28, name: 'Sports' }, { id: 29, name: 'Super Power' }, { id: 30, name: 'Supernatural' },
  { id: 31, name: 'Thriller' }, { id: 32, name: 'Vampire' }, { id: 33, name: 'Isekai' },
  { id: 34, name: 'Psychological' }, { id: 35, name: 'Seinen' }, { id: 36, name: 'Josei' },
]

const TYPES = ['TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL', 'MUSIC']

const NAV_ITEMS = [
  { label: 'Updates', path: '/browse?filter=updates' },
  { label: 'Added', path: '/browse?filter=added' },
  { label: 'Popular', path: '/browse?filter=popular' },
  { label: 'Upcoming', path: '/browse?filter=upcoming' },
  { label: 'Ongoing', path: '/browse?filter=ongoing' },
  { label: 'Completed', path: '/browse?filter=completed' },
  { label: 'Schedule', path: '/schedule' },
]

export default function Navbar() {
  const [toggle, setToggle] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showGenre, setShowGenre] = useState(false)
  const [showType, setShowType] = useState(false)
  const { isAuthenticated, isAdmin, user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const searchRef = useRef(null)
  const genreRef = useRef(null)
  const typeRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (genreRef.current && !genreRef.current.contains(e.target)) setShowGenre(false)
      if (typeRef.current && !typeRef.current.contains(e.target)) setShowType(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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

  const handleRandom = async () => {
    const { searchAnime } = await import('../api/anime')
    try {
      const res = await searchAnime('', 0, 1)
      if (res.data && res.data.length > 0) {
        navigate(`/anime/${res.data[0].malId}`)
      }
    } catch {}
  }

  return (
    <header className="flex items-center justify-between py-4 relative z-50" style={{ minHeight: '3rem' }}>
      <div className="flex items-center gap-8">
        <Link to="/" className="text-primary font-bold text-2xl font-['Pathway_Extreme'] tracking-tight" style={{ fontWeight: 800 }}>
          WatchAnime
        </Link>

        <nav className="hidden lg:flex items-center gap-8">
          <div className="relative" ref={genreRef}>
            <button onMouseEnter={() => setShowGenre(true)} className="text-link uppercase text-[1.07rem] hover:text-white transition-colors">
              Genres
            </button>
            {showGenre && (
              <div
                onMouseLeave={() => setShowGenre(false)}
                className="absolute top-full left-0 mt-2 bg-[#282828] shadow-lg rounded p-3 grid grid-cols-3 gap-x-2 min-w-[27rem]"
                style={{ boxShadow: '0 0.5rem 1rem rgba(0,0,0,.175)' }}
              >
                {GENRES.map((g) => (
                  <Link
                    key={g.id}
                    to={`/browse?genres=${g.id}`}
                    onClick={() => setShowGenre(false)}
                    className="text-link text-[0.95rem] px-2.5 py-1.5 rounded hover:bg-primary hover:text-white transition-colors"
                  >
                    {g.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="relative" ref={typeRef}>
            <button onMouseEnter={() => setShowType(true)} className="text-link uppercase text-[1.07rem] hover:text-white transition-colors">
              Types
            </button>
            {showType && (
              <div
                onMouseLeave={() => setShowType(false)}
                className="absolute top-full left-0 mt-2 bg-[#282828] shadow-lg rounded p-3 min-w-[10rem]"
                style={{ boxShadow: '0 0.5rem 1rem rgba(0,0,0,.175)' }}
              >
                {TYPES.map((t) => (
                  <Link
                    key={t}
                    to={`/browse?type=${t.toLowerCase()}`}
                    onClick={() => setShowType(false)}
                    className="block text-link text-[0.95rem] px-2.5 py-1.5 rounded hover:bg-primary hover:text-white transition-colors"
                  >
                    {t}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              to={item.path}
              className={`text-link uppercase text-[1.07rem] hover:text-white transition-colors ${
                location.pathname === item.path.split('?')[0] &&
                location.search.includes(item.path.split('?')[1]?.split('=')[0] || '') ? 'text-white' : ''
              }`}
            >
              {item.label}
            </Link>
          ))}

          <button onClick={handleRandom} className="text-link uppercase text-[1.07rem] hover:text-white transition-colors">
            Random
          </button>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden lg:flex items-center gap-1 text-link text-sm">
          <Link to="/browse?lang=en" className={`hover:text-white transition-colors ${location.search.includes('lang=en') ? 'text-white' : ''}`}>EN</Link>
          <span className="text-muted">|</span>
          <Link to="/browse?lang=jp" className={`hover:text-white transition-colors ${location.search.includes('lang=jp') ? 'text-white' : ''}`}>JP</Link>
        </div>

        <div className="relative" ref={searchRef}>
          <form onSubmit={handleSearch} className={`flex items-center bg-[#0e0e0e] rounded transition-all duration-300 overflow-hidden ${searchOpen ? 'w-[22rem]' : 'w-0'}`} style={{ height: '2.8rem' }}>
            {searchOpen && (
              <>
                <button type="submit" className="px-2 text-link text-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </button>
                <input
                  type="text"
                  placeholder="Search anime..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="flex-1 bg-transparent text-white outline-none text-sm pr-3"
                />
              </>
            )}
          </form>
          <button onClick={() => setSearchOpen(!searchOpen)} className="text-link text-lg hover:text-white transition-colors p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="hidden sm:flex items-center">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link to="/profile" className="text-link hover:text-white text-sm transition-colors">{user?.name}</Link>
              <button onClick={handleLogout} className="text-muted hover:text-primary text-sm transition-colors">Logout</button>
              {isAdmin && (
                <Link to="/admin" className="text-primary text-sm hover:underline">Admin</Link>
              )}
            </div>
          ) : (
            <Link to="/login" className="text-link hover:text-white text-sm transition-colors">Sign In</Link>
          )}
        </div>

        <button onClick={() => setToggle(!toggle)} className="block xl:hidden text-white">
          {toggle ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>

      {toggle && (
        <div className="absolute top-full left-0 right-0 mx-4 bg-[#282828] rounded-xl shadow-lg p-5 z-50 xl:hidden">
          <div className="flex flex-col gap-3">
            <form onSubmit={(e) => { handleSearch(e); setToggle(false) }} className="flex bg-[#0e0e0e] rounded overflow-hidden mb-2">
              <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 bg-transparent text-white px-3 py-2 outline-none text-sm" />
              <button type="submit" className="bg-primary text-white px-4 text-sm">Go</button>
            </form>
            <Link to="/" onClick={() => setToggle(false)} className="text-link hover:text-white">Home</Link>
            <Link to="/trending" onClick={() => setToggle(false)} className="text-link hover:text-white">Trending</Link>
            <Link to="/seasonal" onClick={() => setToggle(false)} className="text-link hover:text-white">Seasonal</Link>
            <Link to="/news" onClick={() => setToggle(false)} className="text-link hover:text-white">News</Link>
            {NAV_ITEMS.map((item) => (
              <Link key={item.label} to={item.path} onClick={() => setToggle(false)} className="text-link hover:text-white">{item.label}</Link>
            ))}
            <button onClick={() => { setToggle(false); handleRandom() }} className="text-link hover:text-white text-left">Random</button>
            {isAuthenticated && (
              <>
                <Link to="/favorites" onClick={() => setToggle(false)} className="text-link hover:text-white">Favorites</Link>
                <Link to="/watchlist" onClick={() => setToggle(false)} className="text-link hover:text-white">Watchlist</Link>
              </>
            )}
            <hr className="border-gray opacity-30" />
            {isAuthenticated ? (
              <div className="flex items-center justify-between">
                <Link to="/profile" onClick={() => setToggle(false)} className="text-link hover:text-white">{user?.name}</Link>
                <button onClick={() => { handleLogout(); setToggle(false) }} className="text-muted hover:text-primary">Logout</button>
              </div>
            ) : (
              <Link to="/login" onClick={() => setToggle(false)} className="text-link hover:text-white">Sign In</Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
