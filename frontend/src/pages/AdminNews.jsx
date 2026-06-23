import { useState, useEffect } from 'react'
import { getNews, createNews, updateNews, deleteNews } from '../api/news'
import Loading from '../components/Loading'

export default function AdminNews() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const load = (signal) => {
    setLoading(true)
    getNews(0, 100, signal)
      .then((res) => { if (!signal?.aborted) setArticles(res.content || []) })
      .catch(() => {})
      .finally(() => { if (!signal?.aborted) setLoading(false) })
  }

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [])

  const resetForm = () => {
    setEditing(null)
    setTitle('')
    setContent('')
    setImageUrl('')
  }

  const handleEdit = (article) => {
    setEditing(article.id)
    setTitle(article.title)
    setContent(article.content)
    setImageUrl(article.imageUrl || '')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    setSaving(true)
    try {
      if (editing) {
        await updateNews(editing, title, content, imageUrl || null)
        setMessage('Updated!')
      } else {
        await createNews(title, content, imageUrl || null)
        setMessage('Created!')
      }
      resetForm()
      load()
    } catch (err) {
      setMessage(err?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this article?')) return
    try {
      await deleteNews(id)
      load()
    } catch {}
  }

  if (loading) return <Loading />

  return (
    <div>
      <h2 className="text-white text-xl font-semibold mb-4">News Management</h2>
      {message && <div className="text-green-400 text-sm mb-4">{message}</div>}

      <form onSubmit={handleSubmit} className="bg-card p-4 rounded-xl mb-6 space-y-3">
        <h3 className="text-white font-semibold">{editing ? 'Edit Article' : 'New Article'}</h3>
        <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full bg-primary text-white px-4 py-2.5 rounded-lg border border-dimBlue focus:border-secondary outline-none transition" />
        <textarea placeholder="Content" value={content} onChange={(e) => setContent(e.target.value)} required rows={5} className="w-full bg-primary text-white px-4 py-2.5 rounded-lg border border-dimBlue focus:border-secondary outline-none transition resize-none" />
        <input type="url" placeholder="Image URL (optional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full bg-primary text-white px-4 py-2.5 rounded-lg border border-dimBlue focus:border-secondary outline-none transition" />
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="bg-secondary text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50">
            {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
          </button>
          {editing && <button type="button" onClick={resetForm} className="bg-card text-dimWhite px-4 py-2 rounded-lg border border-dimBlue hover:text-white transition">Cancel</button>}
        </div>
      </form>

      <div className="space-y-3">
        {articles.map((article) => (
          <div key={article.id} className="bg-card p-4 rounded-xl flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-semibold">{article.title}</h4>
              <p className="text-dimWhite text-sm line-clamp-2 mt-1">{article.content}</p>
              <span className="text-dimWhite text-xs mt-1 block">{new Date(article.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => handleEdit(article)} className="text-secondary hover:underline text-sm">Edit</button>
              <button onClick={() => handleDelete(article.id)} className="text-red-400 hover:underline text-sm">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
