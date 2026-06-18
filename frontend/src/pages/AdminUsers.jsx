import { useState, useEffect } from 'react'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Admin users endpoint would go here
    setLoading(false)
  }, [])

  return (
    <div className="max-w-[1440px] mx-auto px-4 py-8">
      <h1 className="text-white text-3xl font-bold font-display mb-8">Admin - Users</h1>
      {loading ? (
        <p className="text-muted">Loading...</p>
      ) : users.length === 0 ? (
        <p className="text-muted">No users data available</p>
      ) : (
        <div className="bg-surface/30 border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left p-4 text-muted font-medium">Name</th>
                <th className="text-left p-4 text-muted font-medium">Email</th>
                <th className="text-left p-4 text-muted font-medium">Role</th>
                <th className="text-left p-4 text-muted font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => (
                <tr key={user.id || i} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="p-4 text-white">{user.name}</td>
                  <td className="p-4 text-muted">{user.email}</td>
                  <td className="p-4">
                    <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-lg">{user.role}</span>
                  </td>
                  <td className="p-4">
                    <button className="text-xs text-red-400 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
