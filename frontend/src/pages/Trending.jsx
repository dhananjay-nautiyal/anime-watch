import { useState, useEffect } from 'react'
import { getTrending } from '../api/anime'
import AnimeCard from '../components/AnimeCard'
import { CardSkeleton } from '../components/Skeleton'
import Pagination from '../components/Pagination'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function Trending() {
  useDocumentTitle('Trending')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    setLoading(true)
    getTrending(page, 25, signal)
      .then((res) => {
        if (signal.aborted) return
        setItems(res.data || [])
        setTotalPages(res.totalPages || 1)
      })
      .catch(() => {})
      .finally(() => { if (!signal.aborted) setLoading(false) })

    return () => controller.abort()
  }, [page])

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-white text-3xl font-bold font-display mb-2">Trending Now</h1>
        <p className="text-muted text-sm">Most popular anime right now</p>
      </div>

      {loading ? (
        <CardSkeleton count={12} />
      ) : items.length === 0 ? (
        <p className="text-muted text-center py-16">No trending anime available</p>
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
