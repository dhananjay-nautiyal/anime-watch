import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { resetPassword } from '../api/auth'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      await resetPassword(token, newPassword)
      setMessage('Password reset successfully!')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err?.message || 'Reset failed. The token may be expired.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="bg-card p-8 rounded-2xl text-center">
          <p className="text-red-400">Invalid reset link. No token provided.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12">
      <div className="bg-card p-8 rounded-2xl w-full max-w-md shadow-xl">
        <h1 className="text-white text-2xl font-semibold text-center mb-6">Reset Password</h1>
        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded mb-4 text-sm">{error}</div>}
        {message && <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-2 rounded mb-4 text-sm">{message}</div>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            placeholder="New password (min 6 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            className="bg-primary text-white px-4 py-3 rounded-lg border border-dimBlue focus:border-secondary outline-none transition"
          />
          <button type="submit" disabled={loading} className="bg-secondary text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50">
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
