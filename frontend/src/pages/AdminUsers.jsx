import { useState, useEffect } from 'react'
import { getUsers, adminDeleteUser } from '../api/admin'
import Loading from '../components/Loading'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const load = (signal) => {
    setLoading(true)
    getUsers(signal)
      .then((res) => { if (!signal?.aborted) setUsers(res.data || []) })
      .catch(() => {})
      .finally(() => { if (!signal?.aborted) setLoading(false) })
  }

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [])

  const handleDelete = async (id, email) => {
    if (!window.confirm(`Delete user ${email}?`)) return
    try {
      await adminDeleteUser(id)
      setMessage(`Deleted ${email}`)
      load()
    } catch {}
  }

  if (loading) return <Loading />

  return (
    <div>
      <h2 className="text-white text-xl font-semibold mb-4">Users</h2>
      {message && <div className="text-green-400 text-sm mb-4">{message}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-dimWhite text-sm border-b border-dimBlue">
              <th className="pb-3 pr-4">Name</th>
              <th className="pb-3 pr-4">Email</th>
              <th className="pb-3 pr-4">Role</th>
              <th className="pb-3 pr-4">Verified</th>
              <th className="pb-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-dimBlue/50 text-white">
                <td className="py-3 pr-4">{u.name}</td>
                <td className="py-3 pr-4 text-dimWhite">{u.email}</td>
                <td className="py-3 pr-4">{u.role}</td>
                <td className="py-3 pr-4">{u.verified ? <span className="text-green-400">Yes</span> : <span className="text-red-400">No</span>}</td>
                <td className="py-3">
                  <button onClick={() => handleDelete(u.id, u.email)} className="text-red-400 hover:underline text-sm">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
