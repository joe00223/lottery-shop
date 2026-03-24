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

function fmt(n: number) {
  if (n === 0) return <span className="text-gray-300">—</span>
  return <>{n.toLocaleString()}</>
}

export default function MonthlyPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rows, setRows] = useState<DayRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/monthly-report?year=${y}&month=${m}`)
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setRows(d.rows)
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

  const startEdit = (date: string, current: number) => {
    setEditingDate(date)
    setEditingValue(current === 0 ? '' : String(current))
  }

  const commitEdit = async (date: string) => {
    const val = Math.max(0, parseInt(editingValue) || 0)
    setRows(prev => prev.map(r => r.date === date ? { ...r, virtualSports: val } : r))
    setEditingDate(null)
    await fetch('/api/daily-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, virtualSports: val }),
    })
  }

  const total = rows.reduce((acc, r) => ({
    lotterySales: acc.lotterySales + r.lotterySales,
    scratchSales: acc.scratchSales + r.scratchSales,
    sportsSales: acc.sportsSales + r.sportsSales,
    virtualSports: acc.virtualSports + r.virtualSports,
    extra: acc.extra + r.extra,
  }), { lotterySales: 0, scratchSales: 0, sportsSales: 0, virtualSports: 0, extra: 0 })

  const totalRevenue = (r: DayRow) => r.lotterySales + r.scratchSales + r.sportsSales + r.virtualSports + r.extra
  const grandRevenue = total.lotterySales + total.scratchSales + total.sportsSales + total.virtualSports + total.extra

  const weekDay = ['日', '一', '二', '三', '四', '五', '六']

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
        <div className="overflow-x-auto rounded-xl border border-amber-200 shadow-sm">
          <table className="border-collapse text-sm w-full min-w-[560px]">
            <thead>
              <tr className="bg-amber-100 border-b-2 border-amber-300 text-amber-900 font-bold">
                <th className="px-3 py-2.5 border-r border-amber-300 text-left sticky left-0 bg-amber-100 z-10">日期</th>
                <th className="px-3 py-2.5 border-r border-amber-200 text-right">彩券</th>
                <th className="px-3 py-2.5 border-r border-amber-200 text-right">刮刮樂</th>
                <th className="px-3 py-2.5 border-r border-amber-200 text-right">運彩</th>
                <th className="px-3 py-2.5 border-r border-amber-200 text-right">虛擬運彩</th>
                <th className="px-3 py-2.5 border-r border-amber-200 text-right">額外</th>
                <th className="px-3 py-2.5 text-right">總營業額</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const hasData = r.lotterySales || r.scratchSales || r.sportsSales || r.virtualSports || r.extra
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
                    <td
                      className="px-0 py-0 border-r border-amber-100 text-right tabular-nums cursor-pointer"
                      onClick={() => !isEditing && startEdit(r.date, r.virtualSports)}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          type="text" inputMode="numeric"
                          className="w-full px-3 py-2 text-right text-sm bg-amber-100 focus:outline-none"
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          onBlur={() => commitEdit(r.date)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() }
                            if (e.key === 'Escape') { setEditingDate(null) }
                          }}
                        />
                      ) : (
                        <span className="block px-3 py-2 hover:bg-amber-50">{fmt(r.virtualSports)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 border-r border-amber-100 text-right tabular-nums">
                      {r.extra !== 0 ? <span className={r.extra >= 0 ? '' : 'text-red-600'}>{r.extra > 0 ? '+' : ''}{r.extra.toLocaleString()}</span> : <span className="text-gray-300">—</span>}
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
                <td className="px-3 py-2.5 border-r border-amber-100 text-right tabular-nums text-gray-900">{total.lotterySales > 0 ? total.lotterySales.toLocaleString() : '—'}</td>
                <td className="px-3 py-2.5 border-r border-amber-100 text-right tabular-nums text-gray-900">{total.scratchSales > 0 ? total.scratchSales.toLocaleString() : '—'}</td>
                <td className="px-3 py-2.5 border-r border-amber-100 text-right tabular-nums text-gray-900">{total.sportsSales > 0 ? total.sportsSales.toLocaleString() : '—'}</td>
                <td className="px-3 py-2.5 border-r border-amber-100 text-right tabular-nums text-gray-900">{total.virtualSports > 0 ? total.virtualSports.toLocaleString() : '—'}</td>
                <td className="px-3 py-2.5 border-r border-amber-100 text-right tabular-nums text-gray-900">{total.extra !== 0 ? total.extra.toLocaleString() : '—'}</td>
                <td className="px-3 py-2.5 text-right font-bold text-lg tabular-nums text-amber-950">{grandRevenue > 0 ? grandRevenue.toLocaleString() : '—'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
