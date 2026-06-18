import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getTrending, getSeasonal, searchAnime, filterAnime } from '../api/anime'
import MainCard from '../components/MainCard'
import MiniCard from '../components/MiniCard'
import TopCard from '../components/TopCard'
import Loading from '../components/Loading'

const LATEST_TABS = ['All', 'Sub', 'Dub', 'Trending', 'Random']

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function Home() {
  const [latestTab, setLatestTab] = useState('All')
  const [latestAnime, setLatestAnime] = useState([])
  const [mostViewedTab, setMostViewedTab] = useState('Day')
  const [mostViewed, setMostViewed] = useState([])
  const [newReleases, setNewReleases] = useState([])
  const [completed, setCompleted] = useState([])
  const [loading, setLoading] = useState(true)
  const [latestPage, setLatestPage] = useState(0)
  const [latestTotalPages, setLatestTotalPages] = useState(0)

  const loadLatest = useCallback(async (tab, page = 0) => {
    try {
      if (tab === 'Trending') {
        const res = await getTrending(page, 25)
        setLatestAnime(res.data || [])
        setLatestTotalPages(Math.ceil((res.totalPages || 25) / 25) || 1)
      } else if (tab === 'Random') {
        const promises = []
        for (let i = 0; i < 3; i++) {
          promises.push(searchAnime('', Math.floor(Math.random() * 50), 25))
        }
        const results = await Promise.all(promises)
        const merged = results.flatMap(r => r.data || [])
        setLatestAnime(shuffleArray(merged).slice(0, 25))
        setLatestTotalPages(1)
      } else {
        const res = await getTrending(page, 25)
        setLatestAnime(res.data || [])
        setLatestTotalPages(Math.ceil((res.totalPages || 25) / 25) || 1)
      }
    } catch {}
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      loadLatest(latestTab, latestPage),
      getTrending(0, 25).then(r => setMostViewed(r.data || [])).catch(() => {}),
      getSeasonal(0, 10).then(r => setNewReleases(r.data?.slice(0, 10) || [])).catch(() => {}),
      filterAnime({ status: 'complete', page: 0, size: 10 }).then(r => setCompleted(r.data?.slice(0, 10) || [])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const handleLatestTabChange = (tab) => {
    setLatestTab(tab)
    setLatestPage(0)
    loadLatest(tab, 0)
  }

  const handleLatestPrev = () => {
    if (latestPage > 0) {
      const newPage = latestPage - 1
      setLatestPage(newPage)
      loadLatest(latestTab, newPage)
    }
  }

  const handleLatestNext = () => {
    if (latestPage < latestTotalPages - 1) {
      const newPage = latestPage + 1
      setLatestPage(newPage)
      loadLatest(latestTab, newPage)
    }
  }

  const handleMostViewedTab = (tab) => {
    setMostViewedTab(tab)
    getTrending(0, 10).then(r => setMostViewed(r.data?.slice(0, 10) || [])).catch(() => {})
  }

  if (loading) return <Loading />

  return (
    <div>
      <div className="flex justify-center mb-6 lg:hidden">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const q = e.target.q.value.trim()
            if (q) window.location.href = `/browse?q=${encodeURIComponent(q)}`
          }}
          className="flex w-full max-w-md bg-white rounded overflow-hidden"
          style={{ height: '3.5rem' }}
        >
          <div className="flex items-center ml-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input name="q" type="text" placeholder="Search anime..." className="flex-1 px-3 outline-none text-gray-800 text-lg" />
          <button type="submit" className="bg-primary text-white px-5 font-medium">Filter</button>
        </form>
      </div>

      <section className="mb-8">
        <div className="flex items-end justify-between mb-6">
          <div className="flex items-end gap-6">
            <h2 className="text-textMajor uppercase text-xl font-normal m-0">Latest Episode</h2>
            <div className="flex items-center gap-1">
              {LATEST_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleLatestTabChange(tab)}
                  className={`text-[1.1rem] px-3 transition-colors ${
                    latestTab === tab ? 'text-textMajor' : 'text-muted hover:text-textMajor'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLatestPrev}
              disabled={latestPage === 0}
              className="text-xl text-link hover:text-primary transition-colors disabled:text-muted disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={handleLatestNext}
              disabled={latestPage >= latestTotalPages - 1}
              className="text-xl text-link hover:text-primary transition-colors disabled:text-muted disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex flex-wrap" style={{ margin: '0 -0.43rem' }}>
          {latestAnime.slice(0, 21).map((anime) => (
            <MainCard key={`${anime.malId}-${Math.random()}`} anime={anime} />
          ))}
        </div>
      </section>

      <section className="mb-8">
        <div className="flex flex-wrap" style={{ margin: '0 -1rem' }}>
          <div className="w-full md:w-1/2 lg:w-1/3 px-4 mb-6">
            <div className="bg-card" style={{ borderTop: '0.2rem solid #7c3aed' }}>
              <div className="flex items-center justify-between p-4 pb-0">
                <div className="flex items-center gap-3">
                  <h2 className="text-textMajor uppercase text-xl font-normal">Most Viewed</h2>
                </div>
                <div className="flex items-center gap-1">
                  {['Day', 'Week', 'Month'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => handleMostViewedTab(tab)}
                      className={`text-[1.1rem] px-2 transition-colors ${
                        mostViewedTab === tab ? 'text-textMajor' : 'text-muted hover:text-textMajor'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4">
                {mostViewed.length > 0 && (
                  <Link to={`/anime/${mostViewed[0].malId}`} className="block mb-4 group">
                    <div className="relative" style={{ paddingBottom: '13rem' }}>
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${mostViewed[0].imageUrl || ''})`,
                        }}
                      />
                      <div className="absolute left-0 top-0 flex items-end p-4 z-10" style={{ width: '6rem' }}>
                        <span className="text-[3rem] font-semibold text-card border-b-4 border-card leading-none pb-2 group-hover:text-primary group-hover:border-primary transition-colors">
                          01
                        </span>
                      </div>
                    </div>
                    <div className="p-4 group-hover:bg-secondary transition-colors">
                      <p className="text-link text-xl font-medium truncate group-hover:text-textMajor transition-colors">{mostViewed[0].title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="type-badge bg-badgeTv">TV</span>
                        <span className="text-xs text-[#cecece]">{mostViewed[0].episodes || '?'} eps</span>
                      </div>
                    </div>
                  </Link>
                )}
                <div>
                  {(mostViewed.slice(1, 9) || []).map((anime, i) => (
                    <TopCard key={anime.malId} anime={anime} rank={i + 2} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="w-full md:w-1/2 lg:w-1/3 px-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-textMajor uppercase text-xl font-normal">New Releases</h2>
              <Link to="/seasonal" className="text-link hover:text-primary text-sm transition-colors">View all</Link>
            </div>
            <div className="space-y-[0.3rem]">
              {newReleases.map((anime) => (
                <MiniCard key={anime.malId} anime={anime} />
              ))}
            </div>
          </div>

          <div className="w-full md:w-1/2 lg:w-1/3 px-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-textMajor uppercase text-xl font-normal">Completed</h2>
              <Link to="/browse?filter=completed" className="text-link hover:text-primary text-sm transition-colors">View all</Link>
            </div>
            <div className="space-y-[0.3rem]">
              {completed.map((anime) => (
                <MiniCard key={anime.malId} anime={anime} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
