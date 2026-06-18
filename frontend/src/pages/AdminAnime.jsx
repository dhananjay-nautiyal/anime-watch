import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchAnime } from '../api/anime'
import { setAffiliateUrl, adminDeleteAnime, addAnimeByMalId, importTrendingAnime, importSeasonalAnime } from '../api/admin'
import MainCard from '../components/MainCard'

export default function AdminAnime() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [message, setMessage] = useState('')
  const [affiliateUrl, setAffiliateUrlState] = useState('')
  const [selectedAnime, setSelectedAnime] = useState(null)
  const [malId, setMalId] = useState('')
  const [importing, setImporting] = useState(false)

  const handleSearch = async (e) => {
    e.preventDefault()
    setMessage('')
    try {
      const res = await searchAnime(query, 0, 10)
      setResults(res.data || [])
    } catch {}
  }

  const handleSetAffiliate = async (id) => {
    try {
      await setAffiliateUrl(id, affiliateUrl)
      setMessage('Affiliate URL updated!')
      setSelectedAnime(null)
      setAffiliateUrlState('')
    } catch (err) {
      setMessage(err?.message || 'Failed')
    }
  }

  const handleDeleteAnime = async (id) => {
    if (!window.confirm('Delete this anime and all related reviews/watchlist/favorites?')) return
    try {
      await adminDeleteAnime(id)
      setMessage('Anime deleted')
      setResults((prev) => prev.filter((a) => a.id !== id))
    } catch {}
  }

  const handleAddByMalId = async (e) => {
    e.preventDefault()
    if (!malId) return
    setImporting(true)
    setMessage('')
    try {
      const res = await addAnimeByMalId(malId)
      setMessage(`Imported: ${res.data.title}`)
      setResults([res.data, ...results])
      setMalId('')
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Failed to import anime')
    } finally {
      setImporting(false)
    }
  }

  const handleImportTrending = async () => {
    setImporting(true)
    setMessage('')
    try {
      const res = await importTrendingAnime(0)
      setMessage(`Imported ${res.data.length} trending anime`)
      setResults(res.data || [])
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Failed to import trending')
    } finally {
      setImporting(false)
    }
  }

  const handleImportSeasonal = async () => {
    setImporting(true)
    setMessage('')
    try {
      const res = await importSeasonalAnime(0)
      setMessage(`Imported ${res.data.length} seasonal anime`)
      setResults(res.data || [])
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Failed to import seasonal')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <h2 className="text-white text-xl font-semibold mb-4">Anime Management</h2>
      {message && <div className="text-green-400 text-sm mb-4">{message}</div>}

      <div className="bg-card p-4 rounded-xl mb-6">
        <h3 className="text-white font-semibold mb-3">Import Anime from MyAnimeList</h3>
        <form onSubmit={handleAddByMalId} className="flex gap-3 mb-3">
          <input
            type="number" min="1" placeholder="MAL ID (e.g. 21 for One Piece)" value={malId}
            onChange={(e) => setMalId(e.target.value)}
            className="flex-1 bg-primary text-white px-4 py-2.5 rounded-lg border border-dimBlue focus:border-secondary outline-none transition"
          />
          <button type="submit" disabled={importing} className="bg-secondary text-white px-6 py-2.5 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50">
            {importing ? 'Importing...' : 'Add by ID'}
          </button>
        </form>
        <div className="flex gap-3">
          <button onClick={handleImportTrending} disabled={importing} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50">
            Import Trending
          </button>
          <button onClick={handleImportSeasonal} disabled={importing} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50">
            Import Seasonal
          </button>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <input type="text" placeholder="Search anime by title..." value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1 bg-primary text-white px-4 py-2.5 rounded-lg border border-dimBlue focus:border-secondary outline-none transition" />
        <button type="submit" className="bg-secondary text-white px-6 py-2.5 rounded-lg font-semibold hover:opacity-90 transition">Search</button>
      </form>

      {selectedAnime && (
        <div className="bg-card p-4 rounded-xl mb-6">
          <h3 className="text-white font-semibold mb-2">Set Affiliate URL for {selectedAnime.title}</h3>
          <div className="flex gap-3">
            <input type="url" placeholder="https://..." value={affiliateUrl} onChange={(e) => setAffiliateUrlState(e.target.value)} className="flex-1 bg-primary text-white px-4 py-2 rounded-lg border border-dimBlue focus:border-secondary outline-none transition" />
            <button onClick={() => handleSetAffiliate(selectedAnime.id)} className="bg-secondary text-white px-4 py-2 rounded-lg hover:opacity-90 transition">Save</button>
            <button onClick={() => setSelectedAnime(null)} className="bg-card text-dimWhite px-4 py-2 rounded-lg border border-dimBlue hover:text-white transition">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap" style={{ margin: '0 -0.43rem' }}>
        {results.map((anime) => (
          <div key={anime.malId || anime.id} className="relative group">
            <MainCard anime={anime} />
            <div className="absolute top-2 left-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition">
              <button
                onClick={() => { setSelectedAnime(anime); setAffiliateUrlState(anime.affiliateUrl || '') }}
                className="bg-secondary text-white text-xs px-2 py-1 rounded"
              >
                Affiliate
              </button>
              {anime.id && (
                <button onClick={() => handleDeleteAnime(anime.id)} className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
