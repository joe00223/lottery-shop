'use client'

import { useState, useEffect, useCallback } from 'react'

type DayRow = {
  date: string
  lotterySales: number
  scratchSales: number
  sportsSales: number
  virtualSports: number
  extra: number
}

type MonthlyItem = {
  id: number
  name: string
  income: number
  expense: number
  note: string
}

type EditingCell = { id: number; field: 'name' | 'income' | 'expense' | 'note'; value: string }

function fmt(n: number) {
  if (n === 0) return <span className="text-gray-300">—</span>
  return <>{n.toLocaleString()}</>
}

function round(n: number) { return Math.round(n) }

export default function MonthlyPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rows, setRows] = useState<DayRow[]>([])
  const [items, setItems] = useState<MonthlyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true)
    setError(null)
    try {
      const [reportRes, itemsRes] = await Promise.all([
        fetch(`/api/monthly-report?year=${y}&month=${m}`),
        fetch(`/api/monthly-items?year=${y}&month=${m}`),
      ])
      const report = await reportRes.json()
      const itemsData = await itemsRes.json()
      if (report.error) throw new Error(report.error)
      setRows(report.rows)
      setItems(itemsData)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(year, month) }, [year, month])

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  // Virtual sports inline edit
  const commitVirtualEdit = async (date: string) => {
    const val = Math.max(0, parseInt(editingValue) || 0)
    setRows(prev => prev.map(r => r.date === date ? { ...r, virtualSports: val } : r))
    setEditingDate(null)
    await fetch('/api/daily-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, virtualSports: val }),
    })
  }

  // Monthly item cell edit
  const commitItemCell = async (id: number, field: EditingCell['field'], value: string) => {
    const isNum = field === 'income' || field === 'expense'
    const parsed = isNum ? Math.max(0, parseInt(value) || 0) : value
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: parsed } : it))
    setEditingCell(null)
    await fetch(`/api/monthly-items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: parsed }),
    })
  }

  const addItem = async () => {
    const res = await fetch('/api/monthly-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month, name: '', income: 0, expense: 0, note: '' }),
    })
    const newItem = await res.json()
    setItems(prev => [...prev, newItem])
  }

  const deleteItem = async (id: number) => {
    setItems(prev => prev.filter(it => it.id !== id))
    await fetch(`/api/monthly-items/${id}`, { method: 'DELETE' })
  }

  // Totals
  const total = rows.reduce((acc, r) => ({
    lotterySales: acc.lotterySales + r.lotterySales,
    scratchSales: acc.scratchSales + r.scratchSales,
    sportsSales: acc.sportsSales + r.sportsSales,
    virtualSports: acc.virtualSports + r.virtualSports,
  }), { lotterySales: 0, scratchSales: 0, sportsSales: 0, virtualSports: 0 })

  const totalRevenue = (r: DayRow) => r.lotterySales + r.scratchSales + r.sportsSales + r.virtualSports
  const grandRevenue = total.lotterySales + total.scratchSales + total.sportsSales + total.virtualSports

  // Commissions
  const lotteryComm = round(total.lotterySales * 0.08)
  const scratchComm = round(total.scratchSales * 0.09)
  const sportsComm = round((total.sportsSales + total.virtualSports) * 0.0625)

  // Commission table totals
  const allItems = [
    { id: -1, name: '彩券傭金', income: lotteryComm, expense: 0, note: `${total.lotterySales.toLocaleString()} × 8%`, fixed: true },
    { id: -2, name: '刮刮樂傭金', income: scratchComm, expense: 0, note: `${total.scratchSales.toLocaleString()} × 9%`, fixed: true },
    { id: -3, name: '運彩傭金', income: sportsComm, expense: 0, note: `${(total.sportsSales + total.virtualSports).toLocaleString()} × 6.25%`, fixed: true },
    ...items.map(it => ({ ...it, fixed: false })),
  ]
  const commTotalIncome = allItems.reduce((s, it) => s + it.income, 0)
  const commTotalExpense = allItems.reduce((s, it) => s + it.expense, 0)

  const weekDay = ['日', '一', '二', '三', '四', '五', '六']

  const cellClass = 'px-2 py-1.5 border border-transparent rounded cursor-pointer hover:bg-amber-50 min-w-[60px] block w-full text-right'

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-amber-950">月報表</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="px-3 py-1.5 rounded bg-white border border-amber-300 text-sm font-medium text-amber-900 hover:bg-amber-50">← 上月</button>
          <span className="text-amber-950 font-semibold text-lg min-w-[7rem] text-center">
            {year} / {String(month).padStart(2, '0')}
          </span>
          <button onClick={nextMonth} className="px-3 py-1.5 rounded bg-white border border-amber-300 text-sm font-medium text-amber-900 hover:bg-amber-50">下月 →</button>
        </div>
        {loading && <span className="text-amber-400 text-sm">載入中...</span>}
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-mono break-all mb-4">{error}</div>}

      {!loading && (
        <div className="flex flex-col xl:flex-row gap-6 items-start">

          {/* ── 左：每日銷售表 ── */}
          <div className="overflow-x-auto rounded-xl border border-amber-200 shadow-sm flex-1 min-w-0">
            <table className="border-collapse text-sm w-full min-w-[480px]">
              <thead>
                <tr className="bg-amber-100 border-b-2 border-amber-300 text-amber-900 font-bold">
                  <th className="px-3 py-2.5 border-r border-amber-300 text-left sticky left-0 bg-amber-100 z-10">日期</th>
                  <th className="px-3 py-2.5 border-r border-amber-200 text-right">彩券</th>
                  <th className="px-3 py-2.5 border-r border-amber-200 text-right">刮刮樂</th>
                  <th className="px-3 py-2.5 border-r border-amber-200 text-right">運彩</th>
                  <th className="px-3 py-2.5 border-r border-amber-200 text-right">虛擬運彩</th>
                  <th className="px-3 py-2.5 text-right">總營業額</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const hasData = r.lotterySales || r.scratchSales || r.sportsSales || r.virtualSports
                  const rev = totalRevenue(r)
                  const d = new Date(r.date + 'T12:00:00')
                  const dow = d.getDay()
                  const isEditing = editingDate === r.date
                  return (
                    <tr key={r.date} className={`border-b border-amber-100 ${!hasData ? 'opacity-30' : i % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}`}>
                      <td className={`px-3 py-2 border-r border-amber-200 font-medium sticky left-0 z-10 whitespace-nowrap text-xs
                        ${!hasData ? 'bg-white' : i % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}
                        ${dow === 0 ? 'text-red-600' : dow === 6 ? 'text-blue-600' : 'text-gray-800'}`}>
                        {r.date.slice(5)} ({weekDay[dow]})
                      </td>
                      <td className="px-3 py-2 border-r border-amber-100 text-right tabular-nums">{fmt(r.lotterySales)}</td>
                      <td className="px-3 py-2 border-r border-amber-100 text-right tabular-nums">{fmt(r.scratchSales)}</td>
                      <td className="px-3 py-2 border-r border-amber-100 text-right tabular-nums">{fmt(r.sportsSales)}</td>
                      <td className="px-0 py-0 border-r border-amber-100 text-right tabular-nums cursor-pointer"
                        onClick={() => !isEditing && (setEditingDate(r.date), setEditingValue(r.virtualSports === 0 ? '' : String(r.virtualSports)))}>
                        {isEditing ? (
                          <input autoFocus type="text" inputMode="numeric"
                            className="w-full px-3 py-2 text-right text-sm bg-amber-100 focus:outline-none"
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onBlur={() => commitVirtualEdit(r.date)}
                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingDate(null) }}
                          />
                        ) : (
                          <span className="block px-3 py-2 hover:bg-amber-50">{fmt(r.virtualSports)}</span>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-right font-bold tabular-nums ${rev > 0 ? 'text-amber-900' : 'text-gray-300'}`}>
                        {hasData && rev > 0 ? rev.toLocaleString() : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-amber-100 border-t-2 border-amber-400 font-bold">
                  <td className="px-3 py-2.5 border-r border-amber-300 text-amber-950 sticky left-0 bg-amber-100 z-10">月合計</td>
                  <td className="px-3 py-2.5 border-r border-amber-100 text-right tabular-nums">{total.lotterySales > 0 ? total.lotterySales.toLocaleString() : '—'}</td>
                  <td className="px-3 py-2.5 border-r border-amber-100 text-right tabular-nums">{total.scratchSales > 0 ? total.scratchSales.toLocaleString() : '—'}</td>
                  <td className="px-3 py-2.5 border-r border-amber-100 text-right tabular-nums">{total.sportsSales > 0 ? total.sportsSales.toLocaleString() : '—'}</td>
                  <td className="px-3 py-2.5 border-r border-amber-100 text-right tabular-nums">{total.virtualSports > 0 ? total.virtualSports.toLocaleString() : '—'}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-lg tabular-nums text-amber-950">{grandRevenue > 0 ? grandRevenue.toLocaleString() : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── 右：傭金 / 項目表 ── */}
          <div className="rounded-xl border border-amber-200 shadow-sm overflow-hidden w-full xl:w-auto xl:min-w-[440px]">
            <table className="border-collapse text-sm w-full">
              <thead>
                <tr className="bg-amber-100 border-b-2 border-amber-300 text-amber-900 font-bold">
                  <th className="px-3 py-2.5 border-r border-amber-200 text-left">項目</th>
                  <th className="px-3 py-2.5 border-r border-amber-200 text-right">收入</th>
                  <th className="px-3 py-2.5 border-r border-amber-200 text-right">支出</th>
                  <th className="px-3 py-2.5 text-left">備註</th>
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody>
                {allItems.map((it, i) => (
                  <tr key={it.id} className={`border-b border-amber-100 ${i % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}`}>
                    {/* 項目名稱 */}
                    <td className="px-0 py-0 border-r border-amber-100">
                      {it.fixed ? (
                        <span className="block px-3 py-2 text-amber-900 font-medium whitespace-nowrap">{it.name}</span>
                      ) : editingCell?.id === it.id && editingCell.field === 'name' ? (
                        <input autoFocus type="text"
                          className="w-full px-3 py-2 text-sm bg-amber-100 focus:outline-none"
                          value={editingCell.value}
                          onChange={e => setEditingCell(c => c ? { ...c, value: e.target.value } : c)}
                          onBlur={() => commitItemCell(it.id, 'name', editingCell.value)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCell(null) }}
                        />
                      ) : (
                        <span onClick={() => setEditingCell({ id: it.id, field: 'name', value: it.name })}
                          className="block px-3 py-2 cursor-pointer hover:bg-amber-50 min-w-[80px]">
                          {it.name || <span className="text-gray-300">項目名稱</span>}
                        </span>
                      )}
                    </td>
                    {/* 收入 */}
                    <td className="px-0 py-0 border-r border-amber-100 text-right tabular-nums">
                      {it.fixed ? (
                        <span className="block px-3 py-2 text-green-700 font-semibold">{it.income > 0 ? it.income.toLocaleString() : '—'}</span>
                      ) : editingCell?.id === it.id && editingCell.field === 'income' ? (
                        <input autoFocus type="text" inputMode="numeric"
                          className="w-full px-3 py-2 text-right text-sm bg-amber-100 focus:outline-none"
                          value={editingCell.value}
                          onChange={e => setEditingCell(c => c ? { ...c, value: e.target.value } : c)}
                          onBlur={() => commitItemCell(it.id, 'income', editingCell.value)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCell(null) }}
                        />
                      ) : (
                        <span onClick={() => setEditingCell({ id: it.id, field: 'income', value: it.income === 0 ? '' : String(it.income) })}
                          className="block px-3 py-2 cursor-pointer hover:bg-amber-50 text-green-700 font-semibold">
                          {it.income > 0 ? it.income.toLocaleString() : <span className="text-gray-300">—</span>}
                        </span>
                      )}
                    </td>
                    {/* 支出 */}
                    <td className="px-0 py-0 border-r border-amber-100 text-right tabular-nums">
                      {it.fixed ? (
                        <span className="block px-3 py-2 text-gray-300">—</span>
                      ) : editingCell?.id === it.id && editingCell.field === 'expense' ? (
                        <input autoFocus type="text" inputMode="numeric"
                          className="w-full px-3 py-2 text-right text-sm bg-amber-100 focus:outline-none"
                          value={editingCell.value}
                          onChange={e => setEditingCell(c => c ? { ...c, value: e.target.value } : c)}
                          onBlur={() => commitItemCell(it.id, 'expense', editingCell.value)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCell(null) }}
                        />
                      ) : (
                        <span onClick={() => setEditingCell({ id: it.id, field: 'expense', value: it.expense === 0 ? '' : String(it.expense) })}
                          className="block px-3 py-2 cursor-pointer hover:bg-amber-50 text-red-600 font-semibold">
                          {it.expense > 0 ? it.expense.toLocaleString() : <span className="text-gray-300">—</span>}
                        </span>
                      )}
                    </td>
                    {/* 備註 */}
                    <td className="px-0 py-0">
                      {it.fixed ? (
                        <span className="block px-3 py-2 text-xs text-amber-600">{it.note}</span>
                      ) : editingCell?.id === it.id && editingCell.field === 'note' ? (
                        <input autoFocus type="text"
                          className="w-full px-3 py-2 text-sm bg-amber-100 focus:outline-none"
                          value={editingCell.value}
                          onChange={e => setEditingCell(c => c ? { ...c, value: e.target.value } : c)}
                          onBlur={() => commitItemCell(it.id, 'note', editingCell.value)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCell(null) }}
                        />
                      ) : (
                        <span onClick={() => setEditingCell({ id: it.id, field: 'note', value: it.note })}
                          className="block px-3 py-2 cursor-pointer hover:bg-amber-50 text-xs text-gray-500 min-w-[80px]">
                          {it.note || <span className="text-gray-300">備註</span>}
                        </span>
                      )}
                    </td>
                    {/* 刪除 */}
                    <td className="px-1 text-center">
                      {!it.fixed && (
                        <button onClick={() => deleteItem(it.id)} className="text-red-300 hover:text-red-600 text-xs font-bold">×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-amber-100 border-t-2 border-amber-400 font-bold">
                  <td className="px-3 py-2.5 text-amber-950">合計</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-green-700">{commTotalIncome > 0 ? commTotalIncome.toLocaleString() : '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-red-600">{commTotalExpense > 0 ? commTotalExpense.toLocaleString() : '—'}</td>
                  <td colSpan={2} className="px-3 py-2.5 text-right tabular-nums text-amber-950">
                    {commTotalIncome - commTotalExpense !== 0 && (
                      <span className={commTotalIncome >= commTotalExpense ? 'text-green-700' : 'text-red-600'}>
                        淨 {(commTotalIncome - commTotalExpense) > 0 ? '+' : ''}{(commTotalIncome - commTotalExpense).toLocaleString()}
                      </span>
                    )}
                  </td>
                </tr>
                <tr className="bg-white">
                  <td colSpan={5} className="px-2 py-1.5">
                    <button onClick={addItem} className="w-full py-1 text-xs text-amber-600 hover:bg-amber-50 rounded transition-colors">
                      ＋ 新增項目
                    </button>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

        </div>
      )}
    </div>
  )
}
