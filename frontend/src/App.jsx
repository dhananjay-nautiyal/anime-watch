import { lazy, Suspense } from 'react'
import { Route, Routes, Navigate, useLocation } from 'react-router-dom'
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute'
import Layout from './components/Layout'
import Loading from './components/Loading'
import Home from './pages/Home'
const Browse = lazy(() => import('./pages/Browse'))
const Schedule = lazy(() => import('./pages/Schedule'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Trending = lazy(() => import('./pages/Trending'))
const Seasonal = lazy(() => import('./pages/Seasonal'))
const AnimeDetail = lazy(() => import('./pages/AnimeDetail'))
const WatchPage = lazy(() => import('./pages/WatchPage'))
const Profile = lazy(() => import('./pages/Profile'))
const Favorites = lazy(() => import('./pages/Favorites'))
const Watchlist = lazy(() => import('./pages/Watchlist'))
const News = lazy(() => import('./pages/News'))
const NewsDetail = lazy(() => import('./pages/NewsDetail'))
const AdminUsers = lazy(() => import('./pages/AdminUsers'))
const AdminNews = lazy(() => import('./pages/AdminNews'))
const AdminAnime = lazy(() => import('./pages/AdminAnime'))
const ComingSoon = lazy(() => import('./pages/ComingSoon'))

function AppRoutes() {
  const location = useLocation()
  const isWatchPage = location.pathname.startsWith('/watch')
  const isComingSoonPage = location.pathname.startsWith('/coming-soon')

  const page = (
    <Suspense fallback={<Loading fullScreen />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/trending" element={<Trending />} />
        <Route path="/seasonal" element={<Seasonal />} />
        <Route path="/anime/:id" element={<AnimeDetail />} />
        <Route path="/watch/:malId/:episodeNumber?" element={<WatchPage />} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
        <Route path="/watchlist" element={<ProtectedRoute><Watchlist /></ProtectedRoute>} />
        <Route path="/news" element={<News />} />
        <Route path="/news/:id" element={<NewsDetail />} />
        <Route path="/admin" element={<AdminRoute><AdminUsers /></AdminRoute>} />
        <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
        <Route path="/admin/news" element={<AdminRoute><AdminNews /></AdminRoute>} />
        <Route path="/admin/anime" element={<AdminRoute><AdminAnime /></AdminRoute>} />
        <Route path="/coming-soon/:id" element={<ComingSoon />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )

  if (isWatchPage || isComingSoonPage) {
    return <Layout hideFooter>{page}</Layout>
  }

  return <Layout>{page}</Layout>
}

function App() {
  return <AppRoutes />
}

export default App
