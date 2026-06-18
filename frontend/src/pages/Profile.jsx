import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getProfile, updateProfile, changePassword, deleteAccount } from '../api/user'
import { logout as logoutApi } from '../api/auth'
import Loading from '../components/Loading'

export default function Profile() {
  const { user, setUser, logout } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [profileMsg, setProfileMsg] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getProfile()
      .then((res) => {
        setProfile(res.data)
        setName(res.data.name || '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setProfileMsg('')
    setSaving(true)
    try {
      const res = await updateProfile(name)
      setProfile(res.data)
      setUser((prev) => ({ ...prev, name: res.data.name }))
      setProfileMsg('Profile updated!')
    } catch {
      setProfileMsg('Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPwdMsg('')
    setPwdError('')
    setSaving(true)
    try {
      await changePassword(currentPassword, newPassword)
      setPwdMsg('Password changed!')
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setPwdError(err?.message || 'Failed to change password.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure? This cannot be undone.')) return
    try {
      await deleteAccount()
      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) await logoutApi(refreshToken).catch(() => {})
      logout()
      navigate('/')
    } catch {}
  }

  if (loading) return <Loading />
  if (!profile) return <p className="text-dimWhite text-center py-12">Could not load profile.</p>

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-white text-3xl font-semibold mb-8">My Profile</h1>

      <div className="bg-card p-6 rounded-xl mb-6">
        <h2 className="text-white text-xl font-semibold mb-4">Account Info</h2>
        <p className="text-dimWhite mb-1">Email: <span className="text-white">{profile.email}</span></p>
        <p className="text-dimWhite mb-1">Role: <span className="text-white">{profile.role}</span></p>
        <p className="text-dimWhite mb-1">Verified: <span className={profile.verified ? 'text-green-400' : 'text-red-400'}>{profile.verified ? 'Yes' : 'No'}</span></p>
        <p className="text-dimWhite">Joined: <span className="text-white">{new Date(profile.createdAt).toLocaleDateString()}</span></p>
      </div>

      <div className="bg-card p-6 rounded-xl mb-6">
        <h2 className="text-white text-xl font-semibold mb-4">Edit Profile</h2>
        {profileMsg && <div className={`text-sm mb-3 ${profileMsg.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>{profileMsg}</div>}
        <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="bg-primary text-white px-4 py-3 rounded-lg border border-dimBlue focus:border-secondary outline-none transition" />
          <button type="submit" disabled={saving} className="bg-secondary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>
      </div>

      <div className="bg-card p-6 rounded-xl mb-6">
        <h2 className="text-white text-xl font-semibold mb-4">Change Password</h2>
        {pwdError && <div className="text-red-400 text-sm mb-3">{pwdError}</div>}
        {pwdMsg && <div className="text-green-400 text-sm mb-3">{pwdMsg}</div>}
        <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
          <input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="bg-primary text-white px-4 py-3 rounded-lg border border-dimBlue focus:border-secondary outline-none transition" />
          <input type="password" placeholder="New password (min 6 chars)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} className="bg-primary text-white px-4 py-3 rounded-lg border border-dimBlue focus:border-secondary outline-none transition" />
          <button type="submit" disabled={saving || !currentPassword || !newPassword} className="bg-secondary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50">
            {saving ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>

      <div className="bg-card p-6 rounded-xl border border-red-500/30">
        <h2 className="text-red-400 text-xl font-semibold mb-4">Danger Zone</h2>
        <button onClick={handleDeleteAccount} className="bg-red-500 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-red-600 transition">
          Delete Account
        </button>
      </div>
    </div>
  )
}
