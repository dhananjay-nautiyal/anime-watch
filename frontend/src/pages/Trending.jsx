import { useState, useEffect } from 'react'
import { getTrending, searchAnime, filterAnime } from '../api/anime'
import MainCard from '../components/MainCard'
import Pagination from '../components/Pagination'
import Loading from '../components/Loading'

export default function Trending() {
  const [animeList, setAnimeList] = useState([])
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    setLoading(true)
    const params = { page, size: 25 }
    let promise
    if (query) {
      promise = searchAnime(query, page, 25)
    } else if (genre || type || status) {
      promise = filterAnime({ ...params, genres: genre, type, status })
    } else {
      promise = getTrending(page, 25)
    }
    promise
      .then((res) => {
        setAnimeList(res.data || [])
        setTotalPages(Math.ceil((res.totalPages || res.data?.length) / 25) || 1)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, query, genre, type, status])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(0)
  }

  return (
    <div>
      <h1 className="text-white text-3xl font-semibold mb-6">Browse Anime</h1>

      <div className="bg-card p-4 rounded-xl mb-8">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            placeholder="Search anime..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-primary text-white px-4 py-2.5 rounded-lg border border-dimBlue focus:border-secondary outline-none transition"
          />
          <button type="submit" className="bg-secondary text-white px-6 py-2.5 rounded-lg font-semibold hover:opacity-90 transition">
            Search
          </button>
        </form>
        <div className="flex flex-wrap gap-3">
          <select value={genre} onChange={(e) => { setGenre(e.target.value); setPage(0) }} className="bg-primary text-white px-3 py-2 rounded-lg border border-dimBlue outline-none text-sm">
            <option value="">All Genres</option>
            <option value="1">Action</option>
            <option value="2">Adventure</option>
            <option value="4">Comedy</option>
            <option value="8">Drama</option>
            <option value="10">Fantasy</option>
            <option value="14">Horror</option>
            <option value="7">Mystery</option>
            <option value="22">Romance</option>
            <option value="24">Sci-Fi</option>
            <option value="36">Slice of Life</option>
            <option value="30">Sports</option>
            <option value="37">Supernatural</option>
            <option value="41">Thriller</option>
          </select>
          <select value={type} onChange={(e) => { setType(e.target.value); setPage(0) }} className="bg-primary text-white px-3 py-2 rounded-lg border border-dimBlue outline-none text-sm">
            <option value="">All Types</option>
            <option value="tv">TV</option>
            <option value="movie">Movie</option>
            <option value="ova">OVA</option>
            <option value="special">Special</option>
            <option value="ona">ONA</option>
            <option value="music">Music</option>
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }} className="bg-primary text-white px-3 py-2 rounded-lg border border-dimBlue outline-none text-sm">
            <option value="">All Status</option>
            <option value="airing">Airing</option>
            <option value="complete">Complete</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : animeList.length === 0 ? (
        <p className="text-dimWhite text-center py-12">No anime found.</p>
      ) : (
        <>
          <div className="flex flex-wrap" style={{ margin: '0 -0.43rem' }}>
            {animeList.map((anime) => (
              <MainCard key={anime.malId} anime={anime} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
