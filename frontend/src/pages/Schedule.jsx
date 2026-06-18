import { useState } from 'react'
import { Link } from 'react-router-dom'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function Schedule() {
  const [activeDay, setActiveDay] = useState(new Date().toLocaleDateString('en-US', { weekday: 'long' }))

  return (
    <div>
      <h1 className="text-textMajor uppercase text-xl mb-6">Schedule</h1>
      <div className="bg-card p-6 rounded">
        <div className="flex flex-wrap gap-2 mb-6">
          {DAYS.map((day) => (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                activeDay === day ? 'bg-primary text-white' : 'bg-secondary text-link hover:bg-secondary1'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
        <div className="text-center py-12">
          <p className="text-muted mb-4">Weekly schedule data is not available from the current API source.</p>
          <p className="text-muted text-sm">Browse <Link to="/trending" className="text-primary hover:underline">trending anime</Link> or check <Link to="/seasonal" className="text-primary hover:underline">seasonal releases</Link> instead.</p>
        </div>
      </div>
    </div>
  )
}
