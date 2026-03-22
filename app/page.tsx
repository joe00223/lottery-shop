'use client'

import { useState, useEffect } from 'react'
import ScheduleGrid from '@/components/ScheduleGrid'
import { StoreHours } from '@/lib/utils'

type Employee = {
  id: number
  name: string
  color: string
}

export default function HomePage() {
  const [storeHours, setStoreHours] = useState<StoreHours | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/store').then((r) => r.json()),
      fetch('/api/employees').then((r) => r.json()),
    ]).then(([store, emps]) => {
      setStoreHours(store.hours as StoreHours)
      setEmployees(emps)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-amber-700">
        載入中...
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-amber-950">排班表</h1>
        <div className="flex items-center gap-3">
          {/* Employee legend */}
          <div className="flex items-center gap-2">
            {employees.map((emp) => (
              <span key={emp.id} className="flex items-center gap-1.5 text-sm text-amber-900">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: emp.color }} />
                {emp.name}
              </span>
            ))}
          </div>
          <button
            onClick={() => setEditing((e) => !e)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              editing
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-amber-500 text-white hover:bg-amber-600'
            }`}
          >
            {editing ? '完成編輯' : '編輯排班'}
          </button>
        </div>
      </div>

      {storeHours && (
        <ScheduleGrid storeHours={storeHours} employees={employees} editing={editing} />
      )}
    </div>
  )
}
