import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { verifyEmail } from '../api/auth'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const [message, setMessage] = useState('Verifying your email...')
  const [error, setError] = useState(false)

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      verifyEmail(token)
        .then(() => setMessage('Email verified! You can now log in.'))
        .catch(() => { setError(true); setMessage('Verification failed. The link may be expired.') })
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${error ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
          {error ? (
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <p className={`text-sm mb-4 ${error ? 'text-red-400' : 'text-green-400'}`}>{message}</p>
        <Link to="/login" className="text-primary hover:underline text-sm">Go to Login</Link>
      </div>
    </div>
  )
}
