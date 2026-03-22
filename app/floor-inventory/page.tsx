'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

type Ticket = { id: number; name: string; price: number }
type CellData = { unopened: number; opened: number; onDisplay: number }
type Field = 'unopened' | 'opened' | 'onDisplay'
type EditingCell = { date: string; ticketId: number; field: Field; value: string } | null

const FIELDS: { key: Field; label: string }[] = [
  { key: 'unopened', label: '未開封' },
  { key: 'opened', label: '已開封' },
  { key: 'onDisplay', label: '檯面上' },
]

function toDateStr(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(d)
}

function last7Days() {
  const today = new Date()
  const from = new Date(today.getTime() - 6 * 86400000)
  return { from: toDateStr(from), to: toDateStr(today) }
}

export default function FloorInventoryPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [dates, setDates] = useState<string[]>([])
  const [data, setData] = useState<Record<string, CellData>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditingCell>(null)
  const navigating = useRef(false)
  const [filterInput, setFilterInput] = useState(last7Days())

  const loadTickets = useCallback(async () => {
    const res = await fetch('/api/scratch')
    const d = await res.json()
    if (!Array.isArray(d)) throw new Error(d.error || 'tickets error')
    setTickets(d.filter((t: Ticket & { active: boolean }) => t.active))
  }, [])

  const loadFloor = useCallback(async (from: string, to: string) => {
    const res = await fetch(`/api/floor-inventory?from=${from}&to=${to}`)
    const d = await res.json()
    if (d.error) throw new Error(d.error)

    const dateList = Object.keys(d).sort((a, b) => a.localeCompare(b))
    setDates(dateList)

    const map: Record<string, CellData> = {}
    for (const [date, records] of Object.entries(d)) {
      for (const r of records as (CellData & { scratchTicketId: number })[]) {
        map[`${date}__${r.scratchTicketId}`] = {
          unopened: r.unopened,
          opened: r.opened,
          onDisplay: r.onDisplay,
        }
      }
    }
    setData(map)
  }, [])

  const load = useCallback(async (from: string, to: string) => {
    setLoading(true)
    try {
      await Promise.all([loadTickets(), loadFloor(from, to)])
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [loadTickets, loadFloor])

  useEffect(() => {
    const d = last7Days()
    load(d.from, d.to)
  }, [])

  const applyFilter = () => load(filterInput.from, filterInput.to)

  const addDate = (dateStr: string) => {
    if (!dateStr || dates.includes(dateStr)) return
    setDates(prev => [...prev, dateStr].sort((a, b) => a.localeCompare(b)))
  }

  const deleteDate = async (date: string) => {
    if (!confirm(`確定要刪除 ${date} 的紀錄嗎？`)) return
    await fetch(`/api/floor-inventory/${date}`, { method: 'DELETE' })
    setDates(prev => prev.filter(d => d !== date))
    setData(prev => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        if (key.startsWith(date + '__')) delete next[key]
      }
      return next
    })
  }

  const startEdit = (date: string, ticketId: number, field: Field) => {
    const val = data[`${date}__${ticketId}`]?.[field] ?? 0
    setEditing({ date, ticketId, field, value: String(val) })
  }

  const commitAndMove = (
    ed: EditingCell,
    direction?: 'right' | 'left' | 'up' | 'down',
  ) => {
    if (!ed) return
    const { date, ticketId, field, value } = ed
    const num = Math.max(0, parseInt(value) || 0)

    const key = `${date}__${ticketId}`
    setData(prev => {
      const current = prev[key] ?? { unopened: 0, opened: 0, onDisplay: 0 }
      const updated = { ...current, [field]: num }
      fetch('/api/floor-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, scratchTicketId: ticketId, ...updated }),
      })
      return { ...prev, [key]: updated }
    })

    if (!direction) {
      setEditing(null)
      return
    }

    // columns = dates × fields
    const columns = dates.flatMap(d => FIELDS.map(f => ({ date: d, field: f.key as Field })))
    const colIdx = columns.findIndex(c => c.date === date && c.field === field)
    const ticketIdx = tickets.findIndex(t => t.id === ticketId)

    let nc = colIdx, nt = ticketIdx
    if (direction === 'right') nc = Math.min(nc + 1, columns.length - 1)
    else if (direction === 'left') nc = Math.max(nc - 1, 0)
    else if (direction === 'down') nt = Math.min(nt + 1, tickets.length - 1)
    else if (direction === 'up') nt = Math.max(nt - 1, 0)

    const nextCol = columns[nc]
    const nextTicket = tickets[nt]

    navigating.current = true
    setEditing({
      date: nextCol.date,
      ticketId: nextTicket.id,
      field: nextCol.field,
      value: String(data[`${nextCol.date}__${nextTicket.id}`]?.[nextCol.field] ?? 0),
    })
  }

  const commitEdit = (ed: EditingCell) => {
    if (navigating.current) { navigating.current = false; return }
    commitAndMove(ed)
  }

  // Group tickets by price
  const grouped = Object.entries(
    tickets.reduce<Record<number, Ticket[]>>((acc, t) => {
      if (!acc[t.price]) acc[t.price] = []
      acc[t.price].push(t)
      return acc
    }, {})
  ).sort(([a], [b]) => parseInt(a) - parseInt(b))

  if (loading) return <div className="text-amber-800 mt-8 text-center">載入中...</div>
  if (error) return <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-mono break-all">{error}</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-amber-950">現場庫存</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={filterInput.from}
            onChange={e => setFilterInput(f => ({ ...f, from: e.target.value }))}
            className="border border-amber-300 rounded-lg px-2 py-1 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <span className="text-gray-600 text-sm">～</span>
          <input
            type="date"
            value={filterInput.to}
            onChange={e => setFilterInput(f => ({ ...f, to: e.target.value }))}
            className="border border-amber-300 rounded-lg px-2 py-1 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            onClick={applyFilter}
            className="px-3 py-1.5 bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-sm font-medium hover:bg-amber-200"
          >
            查詢
          </button>
          <div className="w-px h-5 bg-amber-200" />
          <button
            onClick={() => addDate(toDateStr(new Date()))}
            className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
          >
            + 今日
          </button>
          <input
            type="date"
            className="border border-amber-300 rounded-lg px-2 py-1 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            onChange={e => { if (e.target.value) { addDate(e.target.value); e.target.value = '' } }}
            title="新增其他日期"
          />
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center text-gray-500 py-16 bg-white border border-amber-200 rounded-xl">
          請先在「刮刮樂」頁面新增種類
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-amber-200 shadow-sm">
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b-2 border-r border-amber-300 bg-amber-100 px-3 py-2.5 text-amber-950 font-bold text-center sticky left-0 z-20 min-w-[72px]" rowSpan={2}>
                  面額
                </th>
                <th className="border-b-2 border-r-2 border-amber-300 bg-amber-100 px-4 py-2.5 text-amber-950 font-bold text-left min-w-[100px]" rowSpan={2}>
                  名稱
                </th>
                {dates.length === 0 ? (
                  <th className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-gray-500 font-normal text-center">
                    點「+ 今日」新增
                  </th>
                ) : dates.map(date => (
                  <th key={date} colSpan={3} className="border-b-2 border-r border-amber-300 bg-amber-100 px-2 py-1.5 text-amber-900 font-semibold text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-xs font-bold">{date}</span>
                      <button
                        onClick={() => deleteDate(date)}
                        className="text-red-400 hover:text-red-600 text-sm font-bold leading-none"
                        title="刪除此日期"
                      >×</button>
                    </div>
                  </th>
                ))}
              </tr>
              <tr>
                {dates.map(date =>
                  FIELDS.map(f => (
                    <th key={`${date}-${f.key}`} className="border-b border-r border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-700 font-semibold text-center text-xs min-w-[60px]">
                      {f.label}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {grouped.map(([price, priceTickets], gi) =>
                priceTickets.map((t, ti) => (
                  <tr key={t.id} className={gi % 2 === 0 ? 'bg-white' : 'bg-amber-50/60'}>
                    {ti === 0 && (
                      <td
                        rowSpan={priceTickets.length}
                        className="border-b border-r border-amber-200 bg-amber-50 px-3 text-center align-middle sticky left-0 z-10"
                      >
                        <span className="font-bold text-amber-950">${parseInt(price).toLocaleString()}</span>
                      </td>
                    )}
                    <td className="border-b border-r-2 border-amber-200 px-4 py-2.5 text-gray-900 font-medium whitespace-nowrap">
                      {t.name}
                    </td>
                    {dates.flatMap(date =>
                      FIELDS.map(f => {
                        const isEditing =
                          editing?.date === date &&
                          editing?.ticketId === t.id &&
                          editing?.field === f.key
                        const val = data[`${date}__${t.id}`]?.[f.key] ?? 0
                        return (
                          <td
                            key={`${date}-${t.id}-${f.key}`}
                            className="border-b border-r border-amber-100 text-center p-0"
                            onClick={() => !isEditing && startEdit(date, t.id, f.key)}
                          >
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                autoFocus
                                className="w-full px-1 py-2.5 text-center text-sm focus:outline-none bg-amber-50"
                                value={editing.value}
                                onChange={e => setEditing(ed => ed ? { ...ed, value: e.target.value } : ed)}
                                onBlur={() => commitEdit(editing)}
                                onKeyDown={e => {
                                  if (e.key === 'Escape') { setEditing(null); return }
                                  if (e.key === 'Enter' || e.key === 'Tab') {
                                    e.preventDefault()
                                    commitAndMove(editing, e.shiftKey ? 'left' : 'right')
                                    return
                                  }
                                  if (e.key === 'ArrowRight') { e.preventDefault(); commitAndMove(editing, 'right') }
                                  else if (e.key === 'ArrowLeft') { e.preventDefault(); commitAndMove(editing, 'left') }
                                  else if (e.key === 'ArrowDown') { e.preventDefault(); commitAndMove(editing, 'down') }
                                  else if (e.key === 'ArrowUp') { e.preventDefault(); commitAndMove(editing, 'up') }
                                }}
                              />
                            ) : (
                              <span className={`block px-2 py-2.5 cursor-pointer hover:bg-amber-100 transition-colors ${val > 0 ? 'text-gray-900 font-semibold' : 'text-gray-300'}`}>
                                {val}
                              </span>
                            )}
                          </td>
                        )
                      })
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
