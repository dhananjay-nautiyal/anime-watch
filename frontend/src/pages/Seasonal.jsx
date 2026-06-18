import { useState, useEffect } from 'react'
import { getSeasonal } from '../api/anime'
import MainCard from '../components/MainCard'
import Pagination from '../components/Pagination'
import Loading from '../components/Loading'

export default function Seasonal() {
  const [animeList, setAnimeList] = useState([])
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getSeasonal(page, 25)
      .then((res) => {
        setAnimeList(res.data || [])
        setTotalPages(Math.ceil((res.totalPages || res.data?.length) / 25) || 1)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page])

  return (
    <div>
      <h1 className="text-white text-3xl font-semibold mb-6">Current Season</h1>
      {loading ? (
        <Loading />
      ) : animeList.length === 0 ? (
        <p className="text-dimWhite text-center py-12">No seasonal anime found.</p>
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
