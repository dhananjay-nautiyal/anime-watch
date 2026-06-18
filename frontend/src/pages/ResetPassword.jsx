import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../api/auth'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    setLoading(true)
    const token = searchParams.get('token')
    try {
      await resetPassword(token, password)
      setMessage('Password reset! You can now log in.')
    } catch {
      setMessage('Reset failed. The link may be expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-white text-2xl font-bold font-display text-center mb-8">Set New Password</h1>
        <form onSubmit={handleSubmit} className="bg-surface/50 border border-white/5 rounded-2xl p-8 space-y-5">
          {message && (
            <p className={`text-sm ${message.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>{message}</p>
          )}
          <div>
            <label className="text-sm text-muted block mb-2">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition"
              required
              minLength={8}
            />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
          <p className="text-center text-sm text-muted">
            <Link to="/login" className="text-primary hover:underline">Back to Login</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
