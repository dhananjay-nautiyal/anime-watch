import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getNews } from '../api/news'
import Loading from '../components/Loading'
import Pagination from '../components/Pagination'

export default function News() {
  const [articles, setArticles] = useState([])
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getNews(page, 10)
      .then((res) => {
        const data = res.data
        setArticles(data?.content || [])
        setTotalPages(data?.totalPages || 1)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page])

  if (loading) return <Loading />

  return (
    <div>
      <h1 className="text-white text-3xl font-semibold mb-6">Anime News</h1>
      {articles.length === 0 ? (
        <p className="text-dimWhite text-center py-12">No news articles yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <Link key={article.id} to={`/news/${article.id}`} className="bg-card rounded-xl overflow-hidden hover:bg-cardHover transition group">
                {article.imageUrl && (
                  <img src={article.imageUrl} alt={article.title} className="w-full h-44 object-cover" />
                )}
                <div className="p-5">
                  <h2 className="text-white font-semibold text-lg group-hover:text-secondary transition-colors">{article.title}</h2>
                  <p className="text-dimWhite text-sm mt-2 line-clamp-3">{article.content}</p>
                  <div className="flex items-center justify-between mt-4 text-xs text-dimWhite">
                    <span>{article.author || 'Admin'}</span>
                    <span>{new Date(article.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
