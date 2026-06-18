import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getTrending, searchAnime, filterAnime, getSeasonal } from '../api/anime'
import MainCard from '../components/MainCard'
import Loading from '../components/Loading'

export default function Browse() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const filter = searchParams.get('filter') || ''
  const genres = searchParams.get('genres') || ''
  const type = searchParams.get('type') || ''
  const lang = searchParams.get('lang') || ''

  const [animeList, setAnimeList] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const getTitle = () => {
    if (query) return `Search: "${query}"`
    if (genres) return `Genre: ${genres}`
    if (type) return `Type: ${type.toUpperCase()}`
    if (lang) return `Language: ${lang.toUpperCase()}`
    switch (filter) {
      case 'updates': return 'Latest Updates'
      case 'added': return 'Recently Added'
      case 'popular': return 'Most Popular'
      case 'upcoming': return 'Upcoming Anime'
      case 'ongoing': return 'Currently Airing'
      case 'completed': return 'Completed Anime'
      default: return 'Browse Anime'
    }
  }

  useEffect(() => {
    setPage(0)
  }, [query, filter, genres, type, lang])

  useEffect(() => {
    setLoading(true)
    const fetchData = async () => {
      try {
        let res
        if (query) {
          res = await searchAnime(query, page, 25)
        } else if (genres || type) {
          res = await filterAnime({ genres, type: type?.toLowerCase(), page, size: 25 })
        } else if (filter === 'upcoming') {
          res = await filterAnime({ status: 'upcoming', page, size: 25 })
        } else if (filter === 'ongoing') {
          res = await filterAnime({ status: 'airing', page, size: 25 })
        } else if (filter === 'completed') {
          res = await filterAnime({ status: 'complete', page, size: 25 })
        } else if (filter === 'popular' || filter === 'updates' || !filter) {
          res = await getTrending(page, 25)
        } else if (filter === 'added') {
          res = await getSeasonal(page, 25)
        } else {
          res = await getTrending(page, 25)
        }
        setAnimeList(res.data || [])
        setTotalPages(Math.ceil((res.totalPages || 25) / 25) || 1)
      } catch {
        setAnimeList([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [query, filter, genres, type, lang, page])

  return (
    <div>
      <h1 className="text-textMajor uppercase text-xl mb-6">{getTitle()}</h1>
      {loading ? (
        <Loading />
      ) : animeList.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted text-lg">No anime found.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap" style={{ margin: '0 -0.43rem' }}>
            {animeList.map((anime) => (
              <MainCard key={`${anime.malId}-${page}`} anime={anime} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="bg-secondary text-link px-5 py-2 rounded hover:bg-secondary1 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="text-muted text-sm">Page {page + 1} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="bg-secondary text-link px-5 py-2 rounded hover:bg-secondary1 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
