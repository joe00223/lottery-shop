'use client'

import { useState, useEffect, useCallback } from 'react'

type DayRow = {
  date: string
  lotterySales: number
  lotteryRedemption: number
  scratchSales: number
  scratchRedemption: number
  sportsSales: number
  sportsRedemption: number
  extra: number
}

function fmt(n: number) {
  if (n === 0) return <span className="text-gray-300">—</span>
  return <span>{n.toLocaleString()}</span>
}

function fmtNet(n: number) {
  if (n === 0) return <span className="text-gray-300">—</span>
  return <span className={n > 0 ? 'text-gray-900' : 'text-red-600'}>{n > 0 ? '+' : ''}{n.toLocaleString()}</span>
}

function net(sales: number, redemption: number) { return sales - redemption }

export default function MonthlyPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rows, setRows] = useState<DayRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  // Only rows with any data
  const activeRows = rows.filter(r =>
    r.lotterySales || r.lotteryRedemption || r.scratchSales || r.scratchRedemption ||
    r.sportsSales || r.sportsRedemption || r.extra
  )

  const total = rows.reduce((acc, r) => ({
    lotterySales: acc.lotterySales + r.lotterySales,
    lotteryRedemption: acc.lotteryRedemption + r.lotteryRedemption,
    scratchSales: acc.scratchSales + r.scratchSales,
    scratchRedemption: acc.scratchRedemption + r.scratchRedemption,
    sportsSales: acc.sportsSales + r.sportsSales,
    sportsRedemption: acc.sportsRedemption + r.sportsRedemption,
    extra: acc.extra + r.extra,
  }), { lotterySales: 0, lotteryRedemption: 0, scratchSales: 0, scratchRedemption: 0, sportsSales: 0, sportsRedemption: 0, extra: 0 })

  const grandNet =
    total.lotterySales + total.scratchSales + total.sportsSales + total.extra

  const weekDay = ['日', '一', '二', '三', '四', '五', '六']

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-amber-950">月報表</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="px-3 py-1.5 rounded bg-white border border-amber-300 text-sm font-medium text-amber-900 hover:bg-amber-50">
            ← 上月
          </button>
          <span className="text-amber-950 font-semibold text-lg min-w-[7rem] text-center">
            {year} / {String(month).padStart(2, '0')}
          </span>
          <button onClick={nextMonth} className="px-3 py-1.5 rounded bg-white border border-amber-300 text-sm font-medium text-amber-900 hover:bg-amber-50">
            下月 →
          </button>
        </div>
        {loading && <span className="text-amber-400 text-sm">載入中...</span>}
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-mono break-all mb-4">{error}</div>}

      {!loading && (
        <div className="overflow-x-auto rounded-xl border border-amber-200 shadow-sm">
          <table className="border-collapse text-sm w-full min-w-[700px]">
            <thead>
              <tr className="bg-amber-100 border-b-2 border-amber-300">
                <th className="px-3 py-2 border-r border-amber-300 text-left text-amber-900 font-bold sticky left-0 bg-amber-100 z-10" rowSpan={2}>日期</th>
                <th colSpan={3} className="px-3 py-2 border-r border-amber-300 text-center text-amber-900 font-bold">彩券</th>
                <th colSpan={3} className="px-3 py-2 border-r border-amber-300 text-center text-amber-900 font-bold">刮刮樂</th>
                <th colSpan={3} className="px-3 py-2 border-r border-amber-300 text-center text-amber-900 font-bold">運彩</th>
                <th className="px-3 py-2 border-r border-amber-300 text-center text-amber-900 font-bold" rowSpan={2}>額外</th>
                <th className="px-3 py-2 text-center text-amber-950 font-bold" rowSpan={2}>總淨額</th>
              </tr>
              <tr className="bg-amber-50 border-b border-amber-200 text-xs text-amber-600">
                {['銷售', '兌獎', '淨額', '銷售', '兌獎', '淨額', '銷售', '兌獎', '淨額'].map((label, i) => (
                  <th key={i} className={`px-2 py-1.5 font-semibold text-center ${i === 2 || i === 5 || i === 8 ? 'border-r border-amber-300' : 'border-r border-amber-100'}`}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const hasData = r.lotterySales || r.lotteryRedemption || r.scratchSales || r.scratchRedemption || r.sportsSales || r.sportsRedemption || r.extra
                const lotteryNet = net(r.lotterySales, r.lotteryRedemption)
                const scratchNet = net(r.scratchSales, r.scratchRedemption)
                const sportsNet = net(r.sportsSales, r.sportsRedemption)
                const dayNet = r.lotterySales + r.scratchSales + r.sportsSales + r.extra
                const d = new Date(r.date + 'T12:00:00')
                const dow = d.getDay()
                const isSun = dow === 0
                const isSat = dow === 6

                return (
                  <tr key={r.date} className={`border-b border-amber-100 ${!hasData ? 'opacity-30' : i % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}`}>
                    <td className={`px-3 py-2 border-r border-amber-200 font-medium sticky left-0 z-10 whitespace-nowrap ${!hasData ? 'bg-white' : i % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'} ${isSun ? 'text-red-600' : isSat ? 'text-blue-600' : 'text-gray-800'}`}>
                      {r.date.slice(5)} ({weekDay[dow]})
                    </td>
                    <td className="px-2 py-2 border-r border-amber-100 text-right">{fmt(r.lotterySales)}</td>
                    <td className="px-2 py-2 border-r border-amber-100 text-right text-red-500">{r.lotteryRedemption > 0 ? <span>-{r.lotteryRedemption.toLocaleString()}</span> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-2 py-2 border-r border-amber-300 text-right font-semibold">{fmtNet(lotteryNet)}</td>
                    <td className="px-2 py-2 border-r border-amber-100 text-right">{fmt(r.scratchSales)}</td>
                    <td className="px-2 py-2 border-r border-amber-100 text-right text-red-500">{r.scratchRedemption > 0 ? <span>-{r.scratchRedemption.toLocaleString()}</span> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-2 py-2 border-r border-amber-300 text-right font-semibold">{fmtNet(scratchNet)}</td>
                    <td className="px-2 py-2 border-r border-amber-100 text-right">{fmt(r.sportsSales)}</td>
                    <td className="px-2 py-2 border-r border-amber-100 text-right text-red-500">{r.sportsRedemption > 0 ? <span>-{r.sportsRedemption.toLocaleString()}</span> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-2 py-2 border-r border-amber-300 text-right font-semibold">{fmtNet(sportsNet)}</td>
                    <td className="px-2 py-2 border-r border-amber-300 text-right font-semibold">
                      {r.extra !== 0 ? <span className={r.extra >= 0 ? 'text-gray-900' : 'text-red-600'}>{r.extra > 0 ? '+' : ''}{r.extra.toLocaleString()}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`px-3 py-2 text-right font-bold ${dayNet > 0 ? 'text-amber-900' : dayNet < 0 ? 'text-red-600' : 'text-gray-300'}`}>
                      {hasData ? (dayNet !== 0 ? `${dayNet > 0 ? '+' : ''}${dayNet.toLocaleString()}` : '—') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {/* Monthly total */}
            <tfoot>
              <tr className="bg-amber-100 border-t-2 border-amber-400 font-bold">
                <td className="px-3 py-2.5 border-r border-amber-300 text-amber-950 sticky left-0 bg-amber-100 z-10">月合計</td>
                <td className="px-2 py-2.5 border-r border-amber-100 text-right text-gray-900">{total.lotterySales > 0 ? total.lotterySales.toLocaleString() : '—'}</td>
                <td className="px-2 py-2.5 border-r border-amber-100 text-right text-red-600">{total.lotteryRedemption > 0 ? `-${total.lotteryRedemption.toLocaleString()}` : '—'}</td>
                <td className="px-2 py-2.5 border-r border-amber-300 text-right">{fmtNet(net(total.lotterySales, total.lotteryRedemption))}</td>
                <td className="px-2 py-2.5 border-r border-amber-100 text-right text-gray-900">{total.scratchSales > 0 ? total.scratchSales.toLocaleString() : '—'}</td>
                <td className="px-2 py-2.5 border-r border-amber-100 text-right text-red-600">{total.scratchRedemption > 0 ? `-${total.scratchRedemption.toLocaleString()}` : '—'}</td>
                <td className="px-2 py-2.5 border-r border-amber-300 text-right">{fmtNet(net(total.scratchSales, total.scratchRedemption))}</td>
                <td className="px-2 py-2.5 border-r border-amber-100 text-right text-gray-900">{total.sportsSales > 0 ? total.sportsSales.toLocaleString() : '—'}</td>
                <td className="px-2 py-2.5 border-r border-amber-100 text-right text-red-600">{total.sportsRedemption > 0 ? `-${total.sportsRedemption.toLocaleString()}` : '—'}</td>
                <td className="px-2 py-2.5 border-r border-amber-300 text-right">{fmtNet(net(total.sportsSales, total.sportsRedemption))}</td>
                <td className="px-2 py-2.5 border-r border-amber-300 text-right">
                  {total.extra !== 0 ? <span className={total.extra >= 0 ? 'text-gray-900' : 'text-red-600'}>{total.extra > 0 ? '+' : ''}{total.extra.toLocaleString()}</span> : '—'}
                </td>
                <td className={`px-3 py-2.5 text-right text-lg ${grandNet > 0 ? 'text-amber-900' : grandNet < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {grandNet !== 0 ? `${grandNet > 0 ? '+' : ''}${grandNet.toLocaleString()}` : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
