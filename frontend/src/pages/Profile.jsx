import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { updateProfile } from '../api/auth'
import Loading from '../components/Loading'
import { motion } from 'framer-motion'

export default function Profile() {
  const { user, loading, fetchUser } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    setSaving(true)
    try {
      await updateProfile({ name })
      await fetchUser()
      setMessage('Profile updated!')
    } catch {
      setMessage('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-white text-3xl font-bold font-display mb-2">Profile</h1>
        <p className="text-muted text-sm mb-8">Manage your account settings</p>

        <div className="bg-surface/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-2xl font-bold">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <p className="text-white text-lg font-semibold">{user?.name}</p>
              <p className="text-muted text-sm">{user?.email}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6 space-y-4">
          {message && (
            <p className={`text-sm ${message.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>{message}</p>
          )}
          <div>
            <label htmlFor="name" className="text-sm text-muted block mb-2">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition"
            />
          </div>
          <div>
            <label className="text-sm text-muted block mb-2">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-muted outline-none cursor-not-allowed"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all hover:shadow-glow disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
