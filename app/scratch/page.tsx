'use client'

import { useState, useEffect } from 'react'

type ScratchTicket = {
  id: number
  name: string
  price: number
  sheetsPerBook: number
  note: string | null
  active: boolean
}

const EMPTY_FORM = { name: '', price: '', sheetsPerBook: '', note: '' }

export default function ScratchPage() {
  const [tickets, setTickets] = useState<ScratchTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const fetch_ = async () => {
    const res = await fetch('/api/scratch?all=1')
    setTickets(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetch_() }, [])

  const openAdd = () => {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (t: ScratchTicket) => {
    setEditId(t.id)
    setForm({ name: t.name, price: String(t.price), sheetsPerBook: String(t.sheetsPerBook), note: t.note ?? '' })
    setShowForm(true)
  }

  const save = async () => {
    if (!form.name.trim() || !form.price || !form.sheetsPerBook) return
    const body = {
      name: form.name.trim(),
      price: parseInt(form.price),
      sheetsPerBook: parseInt(form.sheetsPerBook),
      note: form.note.trim() || null,
    }
    if (editId) {
      await fetch(`/api/scratch/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } else {
      await fetch('/api/scratch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }
    setShowForm(false)
    fetch_()
  }

  const toggleActive = async (id: number, active: boolean) => {
    await fetch(`/api/scratch/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
    fetch_()
  }

  const active = tickets.filter(t => t.active)
  const stopped = tickets.filter(t => !t.active)

  const grouped = active.reduce<{ [price: number]: ScratchTicket[] }>((acc, t) => {
    if (!acc[t.price]) acc[t.price] = []
    acc[t.price].push(t)
    return acc
  }, {})

  if (loading) return <div className="text-amber-800 mt-8 text-center">載入中...</div>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-amber-950">刮刮樂管理</h1>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
        >
          新增種類
        </button>
      </div>

      {active.length === 0 && stopped.length === 0 ? (
        <div className="text-center text-gray-500 py-16 bg-white border border-amber-200 rounded-xl">
          還沒有刮刮樂種類，點右上角新增
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([price, items]) => (
              <div key={price}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                    ${parseInt(price).toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-600 font-medium">{items.length} 種</span>
                </div>
                <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-amber-100 border-b border-amber-200">
                        <th className="text-left px-4 py-2.5 text-xs font-bold text-amber-900">名稱</th>
                        <th className="text-center px-4 py-2.5 text-xs font-bold text-amber-900">每本張數</th>
                        <th className="text-left px-4 py-2.5 text-xs font-bold text-amber-900">備註</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {items.map((t) => (
                        <tr key={t.id} className="hover:bg-amber-50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-gray-900">{t.name}</td>
                          <td className="px-4 py-3 text-center text-gray-700 font-medium">{t.sheetsPerBook} 張</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{t.note ?? '—'}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button onClick={() => openEdit(t)} className="text-xs text-amber-700 hover:underline font-semibold mr-3">編輯</button>
                            <button
                              onClick={() => toggleActive(t.id, false)}
                              className="text-xs text-red-500 hover:underline font-semibold"
                            >
                              停售
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Stopped tickets */}
      {stopped.length > 0 && (
        <div className="mt-8">
          <h2 className="text-base font-bold text-gray-500 mb-3">已停售</h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-600">名稱</th>
                  <th className="text-center px-4 py-2.5 text-xs font-bold text-gray-600">面額</th>
                  <th className="text-center px-4 py-2.5 text-xs font-bold text-gray-600">每本張數</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stopped.map(t => (
                  <tr key={t.id} className="opacity-60">
                    <td className="px-4 py-3 text-gray-700 font-medium line-through">{t.name}</td>
                    <td className="px-4 py-3 text-center text-gray-600">${t.price.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{t.sheetsPerBook} 張</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleActive(t.id, true)}
                        className="text-xs text-green-700 hover:underline font-semibold"
                      >
                        重新啟用
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96 border-t-4 border-amber-400">
            <h2 className="text-lg font-bold text-amber-950 mb-5">{editId ? '編輯刮刮樂' : '新增刮刮樂'}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">名稱</label>
                <input
                  className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="例：幸運七七"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-800 mb-1">面額（元）</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={form.price}
                    onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="例：100"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-800 mb-1">每本張數</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={form.sheetsPerBook}
                    onChange={(e) => setForm(f => ({ ...f, sheetsPerBook: e.target.value }))}
                    placeholder="例：50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">備註</label>
                <textarea
                  className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  rows={2}
                  value={form.note}
                  onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="選填"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 border border-amber-200 rounded-lg text-sm font-semibold text-gray-800 hover:bg-amber-50"
              >
                取消
              </button>
              <button
                onClick={save}
                className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
              >
                儲存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
