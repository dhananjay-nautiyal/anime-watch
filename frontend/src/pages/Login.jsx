import { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { login as loginApi } from '../api/auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await loginApi(email, password)
      const { token, refreshToken, email: userEmail, name, role } = res.data
      login({ email: userEmail, name, role }, token, refreshToken)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err?.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12">
      <div className="bg-card p-8 rounded-2xl w-full max-w-md shadow-xl">
        <h1 className="text-white text-2xl font-semibold text-center mb-6">Sign In</h1>
        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-primary text-white px-4 py-3 rounded-lg border border-dimBlue focus:border-secondary outline-none transition"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-primary text-white px-4 py-3 rounded-lg border border-dimBlue focus:border-secondary outline-none transition"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-secondary text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div className="flex justify-between mt-4 text-sm">
          <Link to="/register" className="text-dimWhite hover:text-secondary transition">Create account</Link>
          <Link to="/forgot-password" className="text-dimWhite hover:text-secondary transition">Forgot password?</Link>
        </div>
      </div>
    </div>
  )
}
