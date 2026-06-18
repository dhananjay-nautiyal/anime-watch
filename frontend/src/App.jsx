import { Route, Routes, Navigate } from 'react-router-dom'
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import Footer from './components/Footer'

import Home from './pages/Home'
import Browse from './pages/Browse'
import Schedule from './pages/Schedule'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Trending from './pages/Trending'
import Seasonal from './pages/Seasonal'
import AnimeDetail from './pages/AnimeDetail'
import Profile from './pages/Profile'
import Favorites from './pages/Favorites'
import Watchlist from './pages/Watchlist'
import News from './pages/News'
import NewsDetail from './pages/NewsDetail'
import AdminUsers from './pages/AdminUsers'
import AdminNews from './pages/AdminNews'
import AdminAnime from './pages/AdminAnime'

function App() {
  return (
    <div className="bg-body w-full min-h-screen overflow-hidden">
      <div className="max-w-[1370px] mx-auto px-4">
        <Navbar />
        <div className="py-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/trending" element={<Trending />} />
            <Route path="/seasonal" element={<Seasonal />} />
            <Route path="/anime/:id" element={<AnimeDetail />} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
            <Route path="/watchlist" element={<ProtectedRoute><Watchlist /></ProtectedRoute>} />
            <Route path="/news" element={<News />} />
            <Route path="/news/:id" element={<NewsDetail />} />
            <Route path="/admin" element={<AdminRoute><AdminUsers /></AdminRoute>} />
            <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
            <Route path="/admin/news" element={<AdminRoute><AdminNews /></AdminRoute>} />
            <Route path="/admin/anime" element={<AdminRoute><AdminAnime /></AdminRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </div>
  )
}

export default App
