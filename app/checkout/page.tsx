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

type Summary = {
  lotterySales: number
  lotteryRedemption: number
  scratchRedemption: number
  sportsSales: number
  sportsRedemption: number
}

type ExtraItem = { id: number; name: string; amount: number }

function toTaipeiDateStr(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(d)
}

export default function CheckoutPage() {
  const [date, setDate] = useState(toTaipeiDateStr(new Date()))
  const [data, setData] = useState<CheckoutData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary>({
    lotterySales: 0, lotteryRedemption: 0,
    scratchRedemption: 0,
    sportsSales: 0, sportsRedemption: 0,
  })
  const [editingKey, setEditingKey] = useState<keyof Summary | null>(null)
  const [editingVal, setEditingVal] = useState('')
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([])
  const [knownNames, setKnownNames] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState('')

  const loadExtras = async (d: string) => {
    const res = await fetch(`/api/daily-summary-items?date=${d}`)
    const json = await res.json()
    setExtraItems(json.items ?? [])
    setKnownNames(json.names ?? [])
  }

  const load = async (d: string) => {
    setLoading(true)
    setError(null)
    try {
      const [checkoutRes, summaryRes] = await Promise.all([
        fetch(`/api/checkout?date=${d}`),
        fetch(`/api/daily-summary?date=${d}`),
      ])
      const json = await checkoutRes.json()
      if (json.error) throw new Error(json.error)
      setData(json)
      setSummary(await summaryRes.json())
      await loadExtras(d)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const addExtra = async () => {
    const name = newName.trim()
    const amount = parseInt(newAmount)
    if (!name || isNaN(amount)) return
    const res = await fetch('/api/daily-summary-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, name, amount }),
    })
    const item = await res.json()
    setExtraItems(prev => [...prev, item])
    if (!knownNames.includes(name)) setKnownNames(prev => [...prev, name].sort())
    setNewName('')
    setNewAmount('')
  }

  const deleteExtra = async (id: number) => {
    await fetch(`/api/daily-summary-items/${id}`, { method: 'DELETE' })
    setExtraItems(prev => prev.filter(i => i.id !== id))
  }

  useEffect(() => { load(date) }, [])

  const handleDateChange = (d: string) => {
    setDate(d)
    load(d)
  }

  const startEdit = (key: keyof Summary) => {
    setEditingKey(key)
    setEditingVal(String(summary[key]))
  }

  const commitEdit = () => {
    if (!editingKey) return
    const num = Math.max(0, parseInt(editingVal) || 0)
    const updated = { ...summary, [editingKey]: num }
    setSummary(updated)
    setEditingKey(null)
    fetch('/api/daily-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, ...updated }),
    })
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

          {/* Daily summary */}
          {(() => {
            const scratchNet = grandTotal - summary.scratchRedemption
            const lotteryNet = summary.lotterySales - summary.lotteryRedemption
            const sportsNet = summary.sportsSales - summary.sportsRedemption
            const grandNet = lotteryNet + scratchNet + sportsNet

            const SummaryCell = ({ field }: { field: keyof Summary }) => {
              const isEditing = editingKey === field
              return isEditing ? (
                <input
                  type="number" min="0" autoFocus
                  className="w-24 text-right font-semibold text-gray-900 border-b-2 border-amber-400 focus:outline-none bg-transparent"
                  value={editingVal}
                  onChange={e => setEditingVal(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit() }}
                />
              ) : (
                <span
                  className="w-24 text-right font-semibold text-gray-900 cursor-pointer hover:text-amber-700"
                  onClick={() => startEdit(field)}
                >
                  {summary[field].toLocaleString()}
                </span>
              )
            }

            const NetVal = ({ v }: { v: number }) => (
              <span className={`font-bold text-lg ${v > 0 ? 'text-gray-900' : v < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {v.toLocaleString()}
              </span>
            )

            return (
              <>
              <div className="rounded-xl border border-amber-200 shadow-sm overflow-hidden">
                <table className="border-collapse text-sm w-full">
                  <thead>
                    <tr className="bg-amber-100">
                      <th colSpan={2} className="border-b border-r border-amber-200 px-4 py-2 text-amber-950 font-bold text-center">彩券</th>
                      <th colSpan={2} className="border-b border-r border-amber-200 px-4 py-2 text-amber-950 font-bold text-center">刮刮樂</th>
                      <th colSpan={2} className="border-b border-r border-amber-200 px-4 py-2 text-amber-950 font-bold text-center">運彩</th>
                      <th className="border-b border-amber-200 px-4 py-2 text-amber-950 font-bold text-center">總計</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white">
                      <td className="border-b border-r border-amber-100 px-3 py-2.5 text-amber-800 font-semibold text-xs">銷售</td>
                      <td className="border-b border-r border-amber-200 px-3 py-2.5 text-right"><SummaryCell field="lotterySales" /></td>
                      <td className="border-b border-r border-amber-100 px-3 py-2.5 text-amber-800 font-semibold text-xs">銷售</td>
                      <td className="border-b border-r border-amber-200 px-3 py-2.5 text-right font-semibold text-gray-900">{grandTotal.toLocaleString()}</td>
                      <td className="border-b border-r border-amber-100 px-3 py-2.5 text-amber-800 font-semibold text-xs">銷售</td>
                      <td className="border-b border-r border-amber-200 px-3 py-2.5 text-right"><SummaryCell field="sportsSales" /></td>
                      <td className="border-b border-amber-100 px-4 py-2.5 text-center" rowSpan={3}>
                        <NetVal v={grandNet} />
                      </td>
                    </tr>
                    <tr className="bg-amber-50/40">
                      <td className="border-b border-r border-amber-100 px-3 py-2.5 text-amber-800 font-semibold text-xs">兌獎</td>
                      <td className="border-b border-r border-amber-200 px-3 py-2.5 text-right"><SummaryCell field="lotteryRedemption" /></td>
                      <td className="border-b border-r border-amber-100 px-3 py-2.5 text-amber-800 font-semibold text-xs">兌獎</td>
                      <td className="border-b border-r border-amber-200 px-3 py-2.5 text-right"><SummaryCell field="scratchRedemption" /></td>
                      <td className="border-b border-r border-amber-100 px-3 py-2.5 text-amber-800 font-semibold text-xs">兌獎</td>
                      <td className="border-b border-r border-amber-200 px-3 py-2.5 text-right"><SummaryCell field="sportsRedemption" /></td>
                    </tr>
                    <tr className="bg-white">
                      <td className="border-r border-amber-100 px-3 py-2.5 text-amber-800 font-semibold text-xs">總計</td>
                      <td className="border-r border-amber-200 px-3 py-2.5 text-right"><NetVal v={lotteryNet} /></td>
                      <td className="border-r border-amber-100 px-3 py-2.5 text-amber-800 font-semibold text-xs">總計</td>
                      <td className="border-r border-amber-200 px-3 py-2.5 text-right"><NetVal v={scratchNet} /></td>
                      <td className="border-r border-amber-100 px-3 py-2.5 text-amber-800 font-semibold text-xs">總計</td>
                      <td className="border-r border-amber-200 px-3 py-2.5 text-right"><NetVal v={sportsNet} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Extra items */}
              <div className="mt-4 rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                  <span className="font-bold text-amber-950 text-sm">額外項目</span>
                  {extraItems.length > 0 && (
                    <span className={`text-sm font-bold ${extraItems.reduce((s,i)=>s+i.amount,0) >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                      {extraItems.reduce((s,i)=>s+i.amount,0) >= 0 ? '+' : ''}{extraItems.reduce((s,i)=>s+i.amount,0).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="divide-y divide-amber-100">
                  {extraItems.map(item => (
                    <div key={item.id} className="flex items-center px-4 py-2.5 gap-3">
                      <span className="flex-1 text-sm text-gray-800">{item.name}</span>
                      <span className={`text-sm font-semibold ${item.amount >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        {item.amount >= 0 ? '+' : ''}{item.amount.toLocaleString()}
                      </span>
                      <button onClick={() => deleteExtra(item.id)} className="text-red-400 hover:text-red-600 text-xs font-bold">×</button>
                    </div>
                  ))}
                  {/* Add row */}
                  <div className="flex items-center px-4 py-2.5 gap-2">
                    <datalist id="extra-names">
                      {knownNames.map(n => <option key={n} value={n} />)}
                    </datalist>
                    <input
                      list="extra-names"
                      placeholder="項目名稱"
                      className="flex-1 border border-amber-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addExtra() }}
                    />
                    <input
                      type="number"
                      placeholder="金額（負數請打-）"
                      className="w-36 border border-amber-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      value={newAmount}
                      onChange={e => setNewAmount(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addExtra() }}
                    />
                    <button
                      onClick={addExtra}
                      className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
                    >新增</button>
                  </div>
                </div>
              </div>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
