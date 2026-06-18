import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { verifyEmail } from '../api/auth'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState('verifying')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No verification token provided.')
      return
    }
    verifyEmail(token)
      .then(() => {
        setStatus('success')
        setMessage('Email verified successfully! You can now sign in.')
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err?.message || 'Verification failed. The token may be expired.')
      })
  }, [token])

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12">
      <div className="bg-card p-8 rounded-2xl w-full max-w-md shadow-xl text-center">
        {status === 'verifying' && (
          <>
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-secondary mx-auto mb-4"></div>
            <p className="text-dimWhite">Verifying your email...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-green-400 text-5xl mb-4">&#10003;</div>
            <h2 className="text-white text-xl font-semibold mb-2">Email Verified!</h2>
            <p className="text-dimWhite mb-4">{message}</p>
            <Link to="/login" className="bg-secondary text-white px-6 py-2 rounded-lg inline-block hover:opacity-90 transition">
              Sign In
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-red-400 text-5xl mb-4">&times;</div>
            <h2 className="text-white text-xl font-semibold mb-2">Verification Failed</h2>
            <p className="text-dimWhite mb-4">{message}</p>
            <Link to="/" className="text-secondary hover:underline">Back to Home</Link>
          </>
        )}
      </div>
    </div>
  )
}
