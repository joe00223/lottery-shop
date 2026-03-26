'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

type Ticket = { id: number; name: string; price: number; sheetsPerBook: number }
type CellData = { unopened: number; opened: number; onDisplay: number; restockSheets: number }
type Field = 'unopened' | 'opened' | 'onDisplay' | 'restockSheets'
type EditingCell = { date: string; ticketId: number; field: Field; value: string } | null

const FIELDS: { key: Field; label: string }[] = [
  { key: 'unopened', label: '未開封' },
  { key: 'opened', label: '已開封' },
  { key: 'onDisplay', label: '檯面上' },
  { key: 'restockSheets', label: '補張' },
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
  const [pendingDate, setPendingDate] = useState('')
  const [ticketOrder, setTicketOrder] = useState<Record<number, number[]>>({})
  const [dragKey, setDragKey] = useState<{ price: number; ticketId: number } | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)
  const [addBooksModal, setAddBooksModal] = useState<{ ticketId: number; ticketName: string; sheetsPerBook: number } | null>(null)
  const [addBooksDate, setAddBooksDate] = useState(toDateStr(new Date()))
  const [addBooksCount, setAddBooksCount] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('floorInventoryTicketOrder')
      if (saved) setTicketOrder(JSON.parse(saved))
    } catch {}
  }, [])

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
        map[`${date}__${r.scratchTicketId}`] = { unopened: r.unopened, opened: r.opened, onDisplay: r.onDisplay, restockSheets: r.restockSheets ?? 0 }
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

  useEffect(() => { const d = last7Days(); load(d.from, d.to) }, [])

  const applyFilter = () => load(filterInput.from, filterInput.to)

  const addDate = (dateStr: string) => {
    if (!dateStr || dates.includes(dateStr)) return
    setDates(prev => [...prev, dateStr].sort((a, b) => a.localeCompare(b)))
  }

  const confirmPendingDate = () => {
    if (!pendingDate) return
    addDate(pendingDate)
    setPendingDate('')
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

  const grouped = Object.entries(
    tickets.reduce<Record<number, Ticket[]>>((acc, t) => {
      if (!acc[t.price]) acc[t.price] = []
      acc[t.price].push(t)
      return acc
    }, {})
  ).sort(([a], [b]) => parseInt(a) - parseInt(b))

  const getOrderedTickets = (price: number, priceTickets: Ticket[]) => {
    const order = ticketOrder[price]
    if (!order) return priceTickets
    return [...priceTickets].sort((a, b) => {
      const ai = order.indexOf(a.id)
      const bi = order.indexOf(b.id)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
  }

  const orderedAllTickets = grouped.flatMap(([price, pts]) => getOrderedTickets(parseInt(price), pts))

  const handleDragStart = (price: number, ticketId: number) => setDragKey({ price, ticketId })
  const handleDragOver = (e: React.DragEvent, ticketId: number) => { e.preventDefault(); setDragOverId(ticketId) }
  const handleDragEnd = () => { setDragKey(null); setDragOverId(null) }
  const handleDrop = (price: number, targetId: number) => {
    if (!dragKey || dragKey.price !== price || dragKey.ticketId === targetId) { handleDragEnd(); return }
    const priceTickets = grouped.find(([p]) => parseInt(p) === price)?.[1] ?? []
    const currentOrder = ticketOrder[price] ?? priceTickets.map(t => t.id)
    const from = currentOrder.indexOf(dragKey.ticketId)
    const to = currentOrder.indexOf(targetId)
    const newOrder = [...currentOrder]
    newOrder.splice(from, 1)
    newOrder.splice(to, 0, dragKey.ticketId)
    const updated = { ...ticketOrder, [price]: newOrder }
    setTicketOrder(updated)
    localStorage.setItem('floorInventoryTicketOrder', JSON.stringify(updated))
    handleDragEnd()
  }

  const startEdit = (date: string, ticketId: number, field: Field) => {
    const val = data[`${date}__${ticketId}`]?.[field] ?? 0
    setEditing({ date, ticketId, field, value: String(val) })
  }

  const commitAndMove = (ed: EditingCell, direction?: 'right' | 'left' | 'up' | 'down') => {
    if (!ed) return
    const { date, ticketId, field, value } = ed
    const num = Math.max(0, parseInt(value) || 0)

    const key = `${date}__${ticketId}`
    setData(prev => {
      const current = prev[key] ?? { unopened: 0, opened: 0, onDisplay: 0, restockSheets: 0 }
      const updated = { ...current, [field]: num }
      fetch('/api/floor-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, scratchTicketId: ticketId, ...updated }),
      })
      return { ...prev, [key]: updated }
    })

    if (!direction) { setEditing(null); return }

    const cols = orderedAllTickets.flatMap(t => FIELDS.map(f => ({ ticketId: t.id, field: f.key as Field })))
    const colIdx = cols.findIndex(c => c.ticketId === ticketId && c.field === field)
    const dateIdx = dates.indexOf(date)

    let nc = colIdx, nd = dateIdx
    if (direction === 'right') nc = Math.min(nc + 1, cols.length - 1)
    else if (direction === 'left') nc = Math.max(nc - 1, 0)
    else if (direction === 'down') nd = Math.min(nd + 1, dates.length - 1)
    else if (direction === 'up') nd = Math.max(nd - 1, 0)

    const nextCol = cols[nc]
    const nextDate = dates[nd]

    navigating.current = true
    setEditing({
      date: nextDate,
      ticketId: nextCol.ticketId,
      field: nextCol.field,
      value: String(data[`${nextDate}__${nextCol.ticketId}`]?.[nextCol.field] ?? 0),
    })
  }

  const openAddBooks = (t: Ticket) => {
    setAddBooksDate(toDateStr(new Date()))
    setAddBooksCount('')
    setAddBooksModal({ ticketId: t.id, ticketName: t.name, sheetsPerBook: t.sheetsPerBook })
  }

  const saveAddBooks = async () => {
    if (!addBooksModal) return
    const books = Math.max(0, parseInt(addBooksCount) || 0)
    if (books === 0) { setAddBooksModal(null); return }
    const { ticketId, sheetsPerBook } = addBooksModal
    const key = `${addBooksDate}__${ticketId}`
    const current = data[key] ?? { unopened: 0, opened: 0, onDisplay: 0, restockSheets: 0 }
    const newUnopened = current.unopened + books
    const newRestockSheets = current.restockSheets + books * sheetsPerBook
    await Promise.all([
      fetch('/api/floor-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: addBooksDate, scratchTicketId: ticketId, ...current, unopened: newUnopened, restockSheets: newRestockSheets }),
      }),
      fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scratchTicketId: ticketId, type: 'OUT', books, note: `補現場庫存 ${addBooksDate}` }),
      }),
    ])
    setData(prev => ({ ...prev, [key]: { ...current, unopened: newUnopened, restockSheets: newRestockSheets } }))
    addDate(addBooksDate)
    setAddBooksModal(null)
    setAddBooksCount('')
  }

  const commitEdit = (ed: EditingCell) => {
    if (navigating.current) { navigating.current = false; return }
    commitAndMove(ed)
  }

  if (loading) return <div className="text-amber-800 mt-8 text-center">載入中...</div>
  if (error) return <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-mono break-all">{error}</div>

  const CellInput = ({ date, t, f }: { date: string; t: Ticket; f: typeof FIELDS[number] }) => {
    const isEditing = editing?.date === date && editing?.ticketId === t.id && editing?.field === f.key
    const val = data[`${date}__${t.id}`]?.[f.key] ?? 0
    const isLast = f.key === FIELDS[FIELDS.length - 1].key
    return (
      <td className={`border-b text-center p-0 ${isLast ? 'border-r border-amber-300' : 'border-r border-amber-100'}`}
        onClick={() => !isEditing && startEdit(date, t.id, f.key)}
      >
        {isEditing ? (
          <input
            type="text" inputMode="numeric" autoFocus
            className="w-full px-1 py-2 text-center text-sm focus:outline-none bg-amber-100"
            value={editing.value}
            onChange={e => setEditing(ed => ed ? { ...ed, value: e.target.value } : ed)}
            onBlur={() => commitEdit(editing)}
            onKeyDown={e => {
              if (e.key === 'Escape') { setEditing(null); return }
              if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commitAndMove(editing, e.shiftKey ? 'left' : 'right'); return }
              if (e.key === 'ArrowRight') {
                const inp = e.target as HTMLInputElement
                if (inp.selectionStart === inp.value.length) { e.preventDefault(); commitAndMove(editing, 'right') }
              } else if (e.key === 'ArrowLeft') {
                const inp = e.target as HTMLInputElement
                if (inp.selectionStart === 0) { e.preventDefault(); commitAndMove(editing, 'left') }
              } else if (e.key === 'ArrowDown') { e.preventDefault(); commitAndMove(editing, 'down') }
              else if (e.key === 'ArrowUp') { e.preventDefault(); commitAndMove(editing, 'up') }
            }}
          />
        ) : (
          <span className={`block px-2 py-2 cursor-pointer hover:bg-amber-100 transition-colors ${val > 0 ? 'text-gray-800 font-semibold' : 'text-gray-300'}`}>
            {val}
          </span>
        )}
      </td>
    )
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-amber-950">現場庫存</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={filterInput.from}
            onChange={e => setFilterInput(f => ({ ...f, from: e.target.value }))}
            className="border border-amber-300 rounded-lg px-2 py-1 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <span className="text-gray-600 text-sm">～</span>
          <input type="date" value={filterInput.to}
            onChange={e => setFilterInput(f => ({ ...f, to: e.target.value }))}
            className="border border-amber-300 rounded-lg px-2 py-1 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button onClick={applyFilter}
            className="px-3 py-1.5 bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-sm font-medium hover:bg-amber-200"
          >查詢</button>
          <div className="w-px h-5 bg-amber-200" />
          <button onClick={() => addDate(toDateStr(new Date()))}
            className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
          >+ 今日</button>
          <input type="date" value={pendingDate}
            className="border border-amber-300 rounded-lg px-2 py-1 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            onChange={e => setPendingDate(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmPendingDate() }}
            title="選擇日期後按 Enter 或點新增"
          />
          <button onClick={confirmPendingDate}
            className="px-3 py-1.5 bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-sm font-medium hover:bg-amber-200"
          >新增</button>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center text-gray-500 py-16 bg-white border border-amber-200 rounded-xl">
          請先在「刮刮樂」頁面新增種類
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([price, priceTickets]) => {
            const orderedTickets = getOrderedTickets(parseInt(price), priceTickets)
            return (
              <div key={price}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    ${parseInt(price).toLocaleString()}
                  </span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-amber-200 shadow-sm">
                  <table className="border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="border-b-2 border-r border-amber-300 bg-amber-100 px-4 py-2 text-amber-900 font-bold text-left sticky left-0 z-10 min-w-[96px]" rowSpan={2}>
                          日期
                        </th>
                        {orderedTickets.map(t => (
                          <th key={t.id} colSpan={FIELDS.length}
                            draggable
                            onDragStart={() => handleDragStart(parseInt(price), t.id)}
                            onDragOver={e => handleDragOver(e, t.id)}
                            onDrop={() => handleDrop(parseInt(price), t.id)}
                            onDragEnd={handleDragEnd}
                            className={`border-b border-r border-amber-300 px-3 py-2 text-amber-950 font-bold text-center select-none cursor-grab active:cursor-grabbing transition-colors ${
                              dragKey?.ticketId === t.id ? 'opacity-40 bg-amber-50' :
                              dragOverId === t.id && dragKey?.price === parseInt(price) ? 'bg-amber-300' :
                              'bg-amber-100'
                            }`}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              <span>{t.name}</span>
                              <button
                                draggable={false}
                                onMouseDown={e => e.stopPropagation()}
                                onDragStart={e => e.stopPropagation()}
                                onClick={e => { e.stopPropagation(); openAddBooks(t) }}
                                className="text-amber-600 hover:text-white hover:bg-amber-500 border border-amber-400 rounded px-1 text-xs font-bold leading-none py-0.5 transition-colors cursor-pointer"
                                title="補未拆封"
                              >＋</button>
                            </div>
                          </th>
                        ))}
                        <th className="border-b border-amber-200 bg-amber-50 w-8" rowSpan={2} />
                      </tr>
                      <tr>
                        {orderedTickets.map(t =>
                          FIELDS.map((f, fi) => (
                            <th key={`${t.id}-${f.key}`}
                              className={`border-b-2 border-amber-300 bg-amber-50 px-2 py-1.5 text-amber-700 font-semibold text-center text-xs min-w-[64px] ${fi < FIELDS.length - 1 ? 'border-r border-amber-200' : 'border-r border-amber-300'}`}
                            >
                              {f.label}
                            </th>
                          ))
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {dates.length === 0 ? (
                        <tr>
                          <td colSpan={orderedTickets.length * 3 + 2} className="text-center text-gray-500 py-8 text-sm">
                            點「+ 今日」新增日期
                          </td>
                        </tr>
                      ) : (
                        dates.map((date, i) => (
                          <tr key={date} className={i % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}>
                            <td className="border-b border-r border-amber-200 px-4 py-2 text-gray-800 font-semibold text-xs sticky left-0 bg-inherit z-10 whitespace-nowrap">
                              {date}
                            </td>
                            {orderedTickets.map(t =>
                              FIELDS.map(f => <CellInput key={`${t.id}-${f.key}`} date={date} t={t} f={f} />)
                            )}
                            <td className="border-b border-amber-100 px-1 text-center">
                              <button onClick={() => deleteDate(date)} className="text-red-300 hover:text-red-600 text-xs font-bold">×</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {addBooksModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setAddBooksModal(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-80" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-amber-950 mb-4">補未拆封 — {addBooksModal.ticketName}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600">日期</label>
                <input type="date" value={addBooksDate}
                  onChange={e => setAddBooksDate(e.target.value)}
                  className="w-full mt-1 border border-amber-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">本數（1本 = {addBooksModal.sheetsPerBook} 張）</label>
                <input type="text" inputMode="numeric" autoFocus
                  value={addBooksCount}
                  onChange={e => setAddBooksCount(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveAddBooks(); if (e.key === 'Escape') setAddBooksModal(null) }}
                  className="w-full mt-1 border border-amber-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="輸入本數"
                />
              </div>
              <div className="text-xs text-gray-400">
                未拆封 +{parseInt(addBooksCount) || 0} 本　庫存管理 -{parseInt(addBooksCount) || 0} 本
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setAddBooksModal(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={saveAddBooks} className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600">確認</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
