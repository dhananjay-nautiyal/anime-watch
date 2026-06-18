import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from './Loading'

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Loading fullScreen />
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />

  return children
}

export function AdminRoute({ children }) {
  const { isAuthenticated, user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Loading fullScreen />
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  if (user?.role !== 'ROLE_ADMIN') return <Navigate to="/" replace />

  return children
}
