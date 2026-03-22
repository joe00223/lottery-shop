'use client'

import { useState, useEffect } from 'react'

type Row = {
  id: number
  name: string
  price: number
  sheetsPerBook: number
  yesterdayDisplay: number
  supplement: number
  todayDisplay: number
  sold: number
}

type CheckoutData = {
  date: string
  yesterday: string
  rows: Row[]
}

function toTaipeiDateStr(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(d)
}

export default function CheckoutPage() {
  const [date, setDate] = useState(toTaipeiDateStr(new Date()))
  const [data, setData] = useState<CheckoutData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async (d: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/checkout?date=${d}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(date) }, [])

  const handleDateChange = (d: string) => {
    setDate(d)
    load(d)
  }

  // Group rows by price
  const grouped = data
    ? Object.entries(
        data.rows.reduce<Record<number, Row[]>>((acc, r) => {
          if (!acc[r.price]) acc[r.price] = []
          acc[r.price].push(r)
          return acc
        }, {})
      ).sort(([a], [b]) => parseInt(a) - parseInt(b))
    : []

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-amber-950">結帳表</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-amber-900">結帳日期</label>
          <input
            type="date"
            value={date}
            onChange={e => e.target.value && handleDateChange(e.target.value)}
            className="border border-amber-300 rounded-lg px-3 py-1.5 text-sm text-amber-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        {data && (
          <span className="text-xs text-amber-500">
            比較 {data.yesterday} → {data.date}
          </span>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-mono break-all mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-amber-700 text-center py-16">載入中...</div>
      ) : !data || data.rows.length === 0 ? (
        <div className="text-center text-amber-300 py-16 bg-white border border-amber-200 rounded-xl">
          請先在「刮刮樂」頁面新增種類
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-amber-200 shadow-sm">
          <table className="border-collapse text-sm w-full">
            <thead>
              <tr className="bg-amber-100">
                <th className="border-b border-r border-amber-200 px-4 py-2.5 text-amber-700 font-semibold text-center w-28">
                  面額
                </th>
                <th className="border-b border-r border-amber-200 px-4 py-2.5 text-amber-700 font-semibold text-left">
                  名稱
                </th>
                <th className="border-b border-r border-amber-200 px-3 py-2.5 text-amber-700 font-semibold text-center min-w-20">
                  昨日檯面
                </th>
                <th className="border-b border-r border-amber-200 px-3 py-2.5 text-amber-700 font-semibold text-center min-w-20">
                  補張數
                </th>
                <th className="border-b border-r border-amber-200 px-3 py-2.5 text-amber-700 font-semibold text-center min-w-20">
                  今日檯面
                </th>
                <th className="border-b border-amber-200 px-3 py-2.5 text-amber-700 font-semibold text-center min-w-24">
                  銷售張數
                </th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(([price, rows], gi) => {
                const priceNum = parseInt(price)
                const totalSheets = rows.reduce((s, r) => s + r.sold, 0)
                const totalAmount = totalSheets * priceNum
                const bgBase = gi % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'

                return rows.map((r, ri) => (
                  <tr key={r.id} className={bgBase}>
                    {/* Left summary cell — rowspan for entire price group */}
                    {ri === 0 && (
                      <td
                        rowSpan={rows.length}
                        className="border-b border-r border-amber-200 px-3 py-3 text-center align-middle bg-amber-50"
                      >
                        <div className="font-bold text-amber-950 text-base">
                          ${priceNum.toLocaleString()}
                        </div>
                        <div className={`text-sm font-semibold mt-1 ${totalSheets > 0 ? 'text-amber-700' : 'text-amber-300'}`}>
                          {totalSheets} 張
                        </div>
                        <div className={`text-xs mt-0.5 ${totalAmount > 0 ? 'text-amber-600' : 'text-amber-300'}`}>
                          ${totalAmount.toLocaleString()}
                        </div>
                      </td>
                    )}
                    <td className="border-b border-r border-amber-100 px-4 py-2.5 text-amber-900 font-medium">
                      {r.name}
                    </td>
                    <td className="border-b border-r border-amber-100 px-3 py-2.5 text-center text-amber-700">
                      {r.yesterdayDisplay}
                    </td>
                    <td className={`border-b border-r border-amber-100 px-3 py-2.5 text-center font-medium ${r.supplement > 0 ? 'text-green-600' : r.supplement < 0 ? 'text-red-400' : 'text-amber-300'}`}>
                      {r.supplement > 0 ? `+${r.supplement}` : r.supplement}
                    </td>
                    <td className="border-b border-r border-amber-100 px-3 py-2.5 text-center text-amber-700">
                      {r.todayDisplay}
                    </td>
                    <td className={`border-b border-amber-100 px-3 py-2.5 text-center font-bold ${r.sold > 0 ? 'text-amber-950' : 'text-amber-300'}`}>
                      {r.sold}
                    </td>
                  </tr>
                ))
              })}

              {/* Total row */}
              {grouped.length > 0 && (() => {
                const grandTotal = grouped.reduce((sum, [price, rows]) => {
                  const sheets = rows.reduce((s, r) => s + r.sold, 0)
                  return sum + sheets * parseInt(price)
                }, 0)
                const grandSheets = data.rows.reduce((s, r) => s + r.sold, 0)
                return (
                  <tr className="bg-amber-100">
                    <td colSpan={5} className="border-t-2 border-amber-300 px-4 py-3 text-right font-bold text-amber-950">
                      總計
                    </td>
                    <td className="border-t-2 border-amber-300 px-3 py-3 text-center">
                      <div className="font-bold text-amber-950">{grandSheets} 張</div>
                      <div className="text-xs text-amber-600">${grandTotal.toLocaleString()}</div>
                    </td>
                  </tr>
                )
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
