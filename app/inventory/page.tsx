'use client'

import { useState, useEffect } from 'react'

type Log = {
  id: number
  type: 'IN' | 'OUT'
  books: number
  time: string
  note: string | null
}

type Ticket = {
  id: number
  name: string
  price: number
  sheetsPerBook: number
  stock: number
  inventoryLogs: Log[]
}

type FormState = {
  scratchTicketId: number
  type: 'IN' | 'OUT'
  books: string
  time: string
  note: string
}

function toLocalDatetime(date: Date) {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

export default function InventoryPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>({
    scratchTicketId: 0,
    type: 'IN',
    books: '',
    time: toLocalDatetime(new Date()),
    note: '',
  })

  const fetch_ = async () => {
    const res = await fetch('/api/inventory')
    setTickets(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetch_() }, [])

  const openForm = (ticketId: number, type: 'IN' | 'OUT') => {
    setForm({ scratchTicketId: ticketId, type, books: '', time: toLocalDatetime(new Date()), note: '' })
    setShowForm(true)
  }

  const save = async () => {
    if (!form.books || parseInt(form.books) <= 0) return
    await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scratchTicketId: form.scratchTicketId,
        type: form.type,
        books: parseInt(form.books),
        time: new Date(form.time).toISOString(),
        note: form.note.trim() || null,
      }),
    })
    setShowForm(false)
    fetch_()
  }

  const deleteLog = async (id: number) => {
    if (!confirm('確定要刪除這筆紀錄嗎？')) return
    await fetch(`/api/inventory/${id}`, { method: 'DELETE' })
    fetch_()
  }

  const grouped = tickets.reduce<{ [price: number]: Ticket[] }>((acc, t) => {
    if (!acc[t.price]) acc[t.price] = []
    acc[t.price].push(t)
    return acc
  }, {})

  if (loading) return <div className="text-amber-700 mt-8 text-center">載入中...</div>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-amber-950">庫存管理</h1>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center text-amber-300 py-16 bg-white border border-amber-200 rounded-xl">
          請先在「刮刮樂」頁面新增種類
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([price, items]) => (
              <div key={price}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-amber-400 text-amber-950 text-xs font-bold px-2.5 py-1 rounded-full">
                    ${parseInt(price).toLocaleString()}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((t) => (
                    <div key={t.id} className="bg-white border border-amber-200 rounded-xl shadow-sm overflow-hidden">
                      {/* Ticket row */}
                      <div className="flex items-center px-4 py-3 gap-4">
                        <div className="flex-1">
                          <div className="font-semibold text-amber-950">{t.name}</div>
                          <div className="text-xs text-amber-500">{t.sheetsPerBook} 張/本</div>
                        </div>
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${t.stock > 0 ? 'text-amber-700' : 'text-red-400'}`}>
                            {t.stock}
                          </div>
                          <div className="text-xs text-amber-400">本</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openForm(t.id, 'IN')}
                            className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-semibold hover:bg-green-600"
                          >
                            進貨
                          </button>
                          <button
                            onClick={() => openForm(t.id, 'OUT')}
                            className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600"
                          >
                            出貨
                          </button>
                        </div>
                        <button
                          onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                          className="text-xs text-amber-400 hover:text-amber-600 w-16 text-right"
                        >
                          {expandedId === t.id ? '收起' : `紀錄 ${t.inventoryLogs.length}`}
                        </button>
                      </div>

                      {/* Log list */}
                      {expandedId === t.id && t.inventoryLogs.length > 0 && (
                        <div className="border-t border-amber-100">
                          <div className="grid grid-cols-4 px-4 py-2 bg-amber-50 text-xs font-semibold text-amber-600">
                            <span>類型</span>
                            <span>本數</span>
                            <span>時間</span>
                            <span>備註</span>
                          </div>
                          <div className="divide-y divide-amber-50">
                            {t.inventoryLogs.map((log) => (
                              <div key={log.id} className="grid grid-cols-4 px-4 py-2.5 text-sm items-center">
                                <span className={`font-semibold ${log.type === 'IN' ? 'text-green-600' : 'text-amber-600'}`}>
                                  {log.type === 'IN' ? '進貨' : '出貨'}
                                </span>
                                <span className="text-amber-900">{log.books} 本</span>
                                <span className="text-amber-500 text-xs">
                                  {new Date(log.time).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <div className="flex items-center justify-between">
                                  <span className="text-amber-400 text-xs truncate">{log.note ?? '—'}</span>
                                  <button onClick={() => deleteLog(log.id)} className="text-red-300 hover:text-red-500 text-xs ml-2">刪</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {expandedId === t.id && t.inventoryLogs.length === 0 && (
                        <div className="border-t border-amber-100 px-4 py-4 text-center text-amber-300 text-sm">
                          尚無進出紀錄
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 border-t-4 border-amber-400">
            <h2 className="text-lg font-bold text-amber-950 mb-5">
              {form.type === 'IN' ? '進貨' : '出貨'}－{tickets.find(t => t.id === form.scratchTicketId)?.name}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-1">本數</label>
                <input
                  type="number"
                  min="1"
                  className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={form.books}
                  onChange={(e) => setForm(f => ({ ...f, books: e.target.value }))}
                  placeholder="輸入本數"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-1">時間</label>
                <input
                  type="datetime-local"
                  className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={form.time}
                  onChange={(e) => setForm(f => ({ ...f, time: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-1">備註</label>
                <input
                  className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={form.note}
                  onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="選填"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 border border-amber-200 rounded-lg text-sm font-medium text-amber-900 hover:bg-amber-50"
              >
                取消
              </button>
              <button
                onClick={save}
                className={`flex-1 px-4 py-2 text-white rounded-lg text-sm font-semibold ${
                  form.type === 'IN' ? 'bg-green-500 hover:bg-green-600' : 'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                確認{form.type === 'IN' ? '進貨' : '出貨'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
