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
      setMessage('Check your email for reset instructions (if the account exists).')
    } catch {
      setMessage('Check your email for reset instructions (if the account exists).')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12">
      <div className="bg-card p-8 rounded-2xl w-full max-w-md shadow-xl">
        <h1 className="text-white text-2xl font-semibold text-center mb-6">Forgot Password</h1>
        {message && <div className="bg-blue-500/10 border border-blue-500/50 text-blue-400 px-4 py-2 rounded mb-4 text-sm">{message}</div>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-primary text-white px-4 py-3 rounded-lg border border-dimBlue focus:border-secondary outline-none transition"
          />
          <button type="submit" disabled={loading} className="bg-secondary text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50">
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
        <p className="text-dimWhite text-sm text-center mt-4">
          <Link to="/login" className="text-secondary hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
