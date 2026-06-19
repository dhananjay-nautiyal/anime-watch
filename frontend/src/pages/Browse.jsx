import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { searchAnime, filterAnime, getTrending } from '../api/anime'
import AnimeCard from '../components/AnimeCard'
import { CardSkeleton } from '../components/Skeleton'
import Pagination from '../components/Pagination'
import ErrorState from '../components/ErrorState'

const GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Thriller', 'Mystery']
const YEARS = Array.from({ length: 10 }, (_, i) => 2026 - i)
const STATUSES = ['airing', 'complete', 'upcoming']

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [error, setError] = useState(false)

  const q = searchParams.get('q') || ''
  const genre = searchParams.get('genres') || ''
  const year = searchParams.get('year') || ''
  const status = searchParams.get('status') || ''

  useEffect(() => {
    setLoading(true)
    setError(false)

    const fetchData = q
      ? searchAnime(q, page, 25)
      : genre || year || status
        ? filterAnime({ genres: genre, year, status, page, size: 25 })
        : getTrending(page, 25)

    fetchData
      .then((res) => {
        setItems(res.data || [])
        setTotalPages(res.totalPages || 1)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [q, genre, year, status, page])

  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams)
    if (value) params.set(key, value)
    else params.delete(key)
    setSearchParams(params)
    setPage(0)
  }

  const clearFilters = () => {
    setSearchParams({})
    setPage(0)
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-white text-3xl font-bold font-display mb-2">
          {q ? `Results for "${q}"` : 'Browse Anime'}
        </h1>
        <p className="text-muted text-sm">Discover your next favorite anime</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <select
          value={genre}
          onChange={(e) => updateFilter('genres', e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/50 transition"
          aria-label="Filter by genre"
        >
          <option value="">All Genres</option>
          {GENRES.map(g => (
            <option key={g} value={g.toLowerCase()}>{g}</option>
          ))}
        </select>

        <select
          value={year}
          onChange={(e) => updateFilter('year', e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/50 transition"
          aria-label="Filter by year"
        >
          <option value="">All Years</option>
          {YEARS.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => updateFilter('status', e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/50 transition"
          aria-label="Filter by status"
        >
          <option value="">All Status</option>
          {STATUSES.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        {(genre || year || status || q) && (
          <button
            onClick={clearFilters}
            className="text-sm text-muted hover:text-white transition-colors px-4 py-2.5"
          >
            Clear Filters
          </button>
        )}
      </div>

      {loading ? (
        <CardSkeleton count={12} />
      ) : error ? (
        <ErrorState title="Search failed" message="Could not fetch results. Please try again." compact />
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted">No results found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map((anime, i) => (
              <AnimeCard key={`${anime.malId || anime.id}-${i}`} anime={anime} index={i} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
