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

  const FIELDS = [
    { key: 'yesterdayDisplay' as const, label: '昨日檯面' },
    { key: 'supplement' as const, label: '補張數' },
    { key: 'todayDisplay' as const, label: '今日檯面' },
    { key: 'sold' as const, label: '銷售張數' },
  ]

  const grandTotal = grouped.reduce((sum, [price, rows]) => {
    const sheets = rows.reduce((s, r) => s + r.sold, 0)
    return sum + sheets * parseInt(price)
  }, 0)
  const grandSheets = data ? data.rows.reduce((s, r) => s + r.sold, 0) : 0

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
        <div className="space-y-6">
          {grouped.map(([price, rows]) => {
            const priceNum = parseInt(price)
            const totalSheets = rows.reduce((s, r) => s + r.sold, 0)
            const totalAmount = totalSheets * priceNum

            return (
              <div key={price}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    ${priceNum.toLocaleString()}
                  </span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-amber-200 shadow-sm">
                  <table className="border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="border-b border-r border-amber-300 bg-amber-50 px-4 py-2 text-amber-900 font-bold text-left min-w-[80px]">
                          欄位
                        </th>
                        {rows.map(r => (
                          <th key={r.id}
                            className="border-b border-r border-amber-200 bg-amber-100 px-3 py-1.5 text-amber-950 font-bold text-center min-w-[72px]"
                          >
                            {r.name}
                          </th>
                        ))}
                        <th className="border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700 font-bold text-center min-w-[72px]">
                          小計
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {FIELDS.map((f, fi) => {
                        const rowTotal = rows.reduce((s, r) => s + r[f.key], 0)
                        const isSold = f.key === 'sold'
                        return (
                          <tr key={f.key} className={fi % 2 === 0 ? 'bg-white' : 'bg-amber-50/40'}>
                            <td className="border-b border-r border-amber-200 px-4 py-2 text-amber-900 font-semibold text-xs">
                              {f.label}
                            </td>
                            {rows.map(r => {
                              const v = r[f.key]
                              let cls = 'text-gray-700 font-medium'
                              if (f.key === 'supplement') {
                                cls = v > 0 ? 'text-green-600 font-medium' : v < 0 ? 'text-red-500 font-medium' : 'text-gray-400'
                              } else if (isSold) {
                                cls = v > 0 ? 'text-gray-900 font-bold' : 'text-gray-400 font-bold'
                              }
                              return (
                                <td key={r.id}
                                  className="border-b border-r border-amber-100 px-3 py-2 text-center"
                                >
                                  <span className={cls}>
                                    {f.key === 'supplement' && v > 0 ? `+${v}` : v}
                                  </span>
                                </td>
                              )
                            })}
                            <td className="border-b border-amber-100 px-3 py-2 text-center">
                              {isSold ? (
                                <div>
                                  <div className={`font-bold ${rowTotal > 0 ? 'text-gray-900' : 'text-gray-400'}`}>{rowTotal} 張</div>
                                  <div className={`text-xs ${totalAmount > 0 ? 'text-amber-700' : 'text-gray-400'}`}>${totalAmount.toLocaleString()}</div>
                                </div>
                              ) : (
                                <span className="text-gray-500 font-medium">{rowTotal}</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}

          {/* Grand total */}
          {grouped.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-6 py-4 flex items-center gap-6">
              <span className="font-bold text-amber-950 text-base">總計</span>
              <span className="font-bold text-amber-950">{grandSheets} 張</span>
              <span className="text-amber-700 font-semibold">${grandTotal.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
