'use client'

import { useState, useEffect } from 'react'
import { DAYS, DAY_KEYS, StoreHours } from '@/lib/utils'

const DEFAULT_HOURS = { open: '08:00', close: '22:00' }

export default function SettingsPage() {
  const [name, setName] = useState('')
  const [hours, setHours] = useState<StoreHours>({})
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/store').then((r) => r.json()).then((store) => {
      setName(store.name)
      setHours(store.hours as StoreHours)
      setLoading(false)
    })
  }, [])

  const setDayHour = (key: string, field: 'open' | 'close', value: string) => {
    setHours((h) => ({ ...h, [key]: { ...(h[key] ?? DEFAULT_HOURS), [field]: value } }))
  }

  const save = async () => {
    await fetch('/api/store', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, hours }),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="text-amber-700 mt-8 text-center">載入中...</div>

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-amber-950 mb-6">店家設定</h1>

      <div className="bg-white border border-amber-200 rounded-xl shadow-sm p-6 mb-6">
        <label className="block text-sm font-medium text-amber-900 mb-1">店家名稱</label>
        <input
          className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="bg-white border border-amber-200 rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-amber-950 mb-4">每日營業時間</h2>
        <div className="space-y-3">
          {DAYS.map((day, idx) => {
            const key = DAY_KEYS[idx]
            const h = hours[key] ?? DEFAULT_HOURS
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="w-8 text-sm font-semibold text-amber-900 text-center">{day}</span>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={h.open}
                    onChange={(e) => setDayHour(key, 'open', e.target.value)}
                    className="border border-amber-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <span className="text-amber-400 text-sm">至</span>
                  <input
                    type="time"
                    value={h.close}
                    onChange={(e) => setDayHour(key, 'close', e.target.value)}
                    className="border border-amber-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <button
        onClick={save}
        className={`px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors ${
          saved ? 'bg-green-600' : 'bg-amber-500 hover:bg-amber-600'
        }`}
      >
        {saved ? '已儲存' : '儲存設定'}
      </button>
    </div>
  )
}
