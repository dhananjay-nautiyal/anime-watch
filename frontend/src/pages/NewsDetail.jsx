import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getNewsById } from '../api/news'
import Loading from '../components/Loading'

export default function NewsDetail() {
  const { id } = useParams()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getNewsById(id)
      .then((res) => setArticle(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <Loading />
  if (!article) return <p className="text-dimWhite text-center py-12">Article not found.</p>

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/news" className="text-secondary hover:underline text-sm mb-4 inline-block">&larr; Back to News</Link>
      {article.imageUrl && (
        <img src={article.imageUrl} alt={article.title} className="w-full h-64 object-cover rounded-xl mb-6" />
      )}
      <h1 className="text-white text-3xl font-bold mb-2">{article.title}</h1>
      <div className="flex items-center gap-4 text-dimWhite text-sm mb-6">
        <span>By {article.author || 'Admin'}</span>
        <span>{new Date(article.createdAt).toLocaleDateString()}</span>
      </div>
      <div className="text-dimWhite leading-relaxed whitespace-pre-wrap">{article.content}</div>
    </div>
  )
}
