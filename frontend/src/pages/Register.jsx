import { useState } from 'react'
import { Link } from 'react-router-dom'
import { register as registerApi } from '../api/auth'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await registerApi(name, email, password)
      setSuccess('Account created! Check your email to verify your account.')
    } catch (err) {
      setError(err?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12">
      <div className="bg-card p-8 rounded-2xl w-full max-w-md shadow-xl">
        <h1 className="text-white text-2xl font-semibold text-center mb-6">Create Account</h1>
        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded mb-4 text-sm">{error}</div>}
        {success && <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-2 rounded mb-4 text-sm">{success}</div>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="bg-primary text-white px-4 py-3 rounded-lg border border-dimBlue focus:border-secondary outline-none transition"
          />
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
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="bg-primary text-white px-4 py-3 rounded-lg border border-dimBlue focus:border-secondary outline-none transition"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-secondary text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
        <p className="text-dimWhite text-sm text-center mt-4">
          Already have an account? <Link to="/login" className="text-secondary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
