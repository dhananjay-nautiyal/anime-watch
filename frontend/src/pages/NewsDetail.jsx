import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getNewsById } from '../api/news'
import ImageWithFallback from '../components/ImageWithFallback'
import Loading from '../components/Loading'
import ErrorState from '../components/ErrorState'

export default function NewsDetail() {
  const { id } = useParams()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    getNewsById(id)
      .then(setArticle)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <Loading />
  if (error) return <ErrorState title="Article not found" message="This news article doesn't exist or has been removed." />

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Link to="/news" className="text-muted hover:text-primary text-sm transition-colors inline-flex items-center gap-1 mb-6">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to News
        </Link>

        {article?.imageUrl && (
          <div className="aspect-video rounded-2xl overflow-hidden mb-8">
            <ImageWithFallback
              src={article.imageUrl}
              alt={article.title}
              className="w-full"
              aspectRatio=""
              containerClass="w-full h-full"
              lazy={false}
            />
          </div>
        )}

        <h1 className="text-white text-3xl md:text-4xl font-bold font-display mb-4">{article?.title}</h1>
        <div className="flex items-center gap-4 text-muted text-sm mb-8 pb-8 border-b border-white/5">
          <span>By {article?.author || 'Admin'}</span>
          <span>{article?.createdAt ? new Date(article.createdAt).toLocaleDateString() : ''}</span>
        </div>
        <div className="text-link/80 leading-relaxed whitespace-pre-wrap text-sm">
          {article?.content}
        </div>
      </motion.div>
    </div>
  )
}
