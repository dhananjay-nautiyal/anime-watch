import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../api/auth'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    setLoading(true)
    try {
      await forgotPassword(email)
      setMessage('Check your email for reset instructions')
    } catch {
      setMessage('Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-white text-2xl font-bold font-display text-center mb-8">Reset Password</h1>
        <form onSubmit={handleSubmit} className="bg-surface/50 border border-white/5 rounded-2xl p-8 space-y-5">
          {message && (
            <p className={`text-sm ${message.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>{message}</p>
          )}
          <div>
            <label className="text-sm text-muted block mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
            {loading ? 'Sending...' : 'Send Reset Email'}
          </button>
          <p className="text-center text-sm text-muted">
            <Link to="/login" className="text-primary hover:underline">Back to Login</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
