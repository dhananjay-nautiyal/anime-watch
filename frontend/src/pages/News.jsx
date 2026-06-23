import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getNews } from '../api/news'
import { motion } from 'framer-motion'
import ImageWithFallback from '../components/ImageWithFallback'
import Pagination from '../components/Pagination'
import { CardSkeleton } from '../components/Skeleton'

export default function News() {
  const [articles, setArticles] = useState([])
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    setLoading(true)
    getNews(page, 10, signal)
      .then((res) => {
        if (signal.aborted) return
        setArticles(res.content || [])
        setTotalPages(res.totalPages || 1)
      })
      .catch(() => {})
      .finally(() => { if (!signal.aborted) setLoading(false) })

    return () => controller.abort()
  }, [page])

  if (loading) return <div className="max-w-[1440px] mx-auto px-4 py-8"><CardSkeleton count={6} /></div>

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-white text-3xl font-bold font-display mb-2">Anime News</h1>
        <p className="text-muted text-sm">Latest updates from the anime world</p>
      </div>

      {articles.length === 0 ? (
        <p className="text-muted text-center py-16">No news articles yet</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
              >
                <Link to={`/news/${article.id}`} className="group block bg-surface/30 backdrop-blur-sm border border-white/5 rounded-2xl overflow-hidden hover:bg-surface/50 transition-all hover:-translate-y-1">
                  {article.imageUrl ? (
                    <div className="aspect-video overflow-hidden">
                      <ImageWithFallback
                        src={article.imageUrl}
                        alt={article.title}
                        className="group-hover:scale-105 transition-transform duration-500"
                        aspectRatio=""
                        containerClass="w-full h-full"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-surface flex items-center justify-center">
                      <span className="text-muted text-xs">No image</span>
                    </div>
                  )}
                  <div className="p-5">
                    <h2 className="text-white font-semibold text-lg group-hover:text-primary transition-colors line-clamp-2">{article.title}</h2>
                    <p className="text-muted text-sm mt-2 line-clamp-3">{article.content}</p>
                    <div className="flex items-center justify-between mt-4 text-xs text-muted">
                      <span>{article.author || 'Admin'}</span>
                      <span>{new Date(article.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
