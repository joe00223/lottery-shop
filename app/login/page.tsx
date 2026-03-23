'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const storeName = process.env.NEXT_PUBLIC_STORE_NAME ?? '彩券行管理系統'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        router.push('/')
        router.refresh()
      } else {
        const d = await res.json()
        setError(d.error ?? '登入失敗')
      }
    } catch {
      setError('網路錯誤，請再試一次')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Store name */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-400 shadow-md mb-4">
            <span className="text-3xl">🎟</span>
          </div>
          <h1 className="text-2xl font-bold text-amber-950">{storeName}</h1>
          <p className="text-amber-700 text-sm mt-1">管理系統</p>
        </div>

        {/* Login card */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-amber-200 p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-amber-900 mb-1.5">密碼</label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-amber-300 rounded-xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400 text-base"
              placeholder="請輸入密碼"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-semibold text-base hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {loading ? '登入中...' : '登入'}
          </button>
        </form>
      </div>
    </div>
  )
}
