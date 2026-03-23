'use client'

import { useState, useEffect, useRef } from 'react'

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

type Slot = { id?: number; name: string; amount: string }

const MIN_SLOTS = 8

function toTaipeiDateStr(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(d)
}

function itemsToSlots(items: { id: number; name: string; amount: number }[]): Slot[] {
  const filled: Slot[] = items.map(i => ({ id: i.id, name: i.name, amount: String(i.amount) }))
  while (filled.length < MIN_SLOTS) filled.push({ name: '', amount: '' })
  return filled
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
  const [slots, setSlots] = useState<Slot[]>(itemsToSlots([]))
  const [knownNames, setKnownNames] = useState<string[]>([])
  const inputRefs = useRef<(HTMLInputElement | null)[][]>([])
  const navigating = useRef(false)
  const pendingFocus = useRef<[number, number] | null>(null)

  useEffect(() => {
    if (pendingFocus.current) {
      const [r, c] = pendingFocus.current
      pendingFocus.current = null
      inputRefs.current[r]?.[c]?.focus()
    }
  }, [slots.length])

  const load = async (d: string) => {
    setLoading(true)
    setError(null)
    try {
      const [checkoutRes, summaryRes, itemsRes] = await Promise.all([
        fetch(`/api/checkout?date=${d}`),
        fetch(`/api/daily-summary?date=${d}`),
        fetch(`/api/daily-summary-items?date=${d}`),
      ])
      const json = await checkoutRes.json()
      if (json.error) throw new Error(json.error)
      setData(json)
      setSummary(await summaryRes.json())
      const itemsJson = await itemsRes.json()
      setSlots(itemsToSlots(itemsJson.items ?? []))
      setKnownNames(itemsJson.names ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(date) }, [])

  const handleDateChange = (d: string) => { setDate(d); load(d) }

  const startEdit = (key: keyof Summary) => { setEditingKey(key); setEditingVal(String(summary[key])) }
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

  const updateSlot = (idx: number, field: 'name' | 'amount', value: string) => {
    setSlots(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  const saveSlot = async (idx: number) => {
    if (navigating.current) { navigating.current = false; return }
    const slot = slots[idx]
    const name = slot.name.trim()
    const amount = parseInt(slot.amount)

    if (!name || isNaN(amount)) {
      if (slot.id) {
        await fetch(`/api/daily-summary-items/${slot.id}`, { method: 'DELETE' })
        setSlots(prev => prev.map((s, i) => i === idx ? { name: '', amount: '' } : s))
      }
      return
    }

    if (slot.id) {
      fetch(`/api/daily-summary-items/${slot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, amount }),
      })
      if (!knownNames.includes(name)) setKnownNames(prev => [...prev, name].sort())
    } else {
      const res = await fetch('/api/daily-summary-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, name, amount }),
      })
      const item = await res.json()
      setSlots(prev => prev.map((s, i) => i === idx ? { ...s, id: item.id } : s))
      if (!knownNames.includes(name)) setKnownNames(prev => [...prev, name].sort())
    }
  }

  const addSlot = () => setSlots(prev => [...prev, { name: '', amount: '' }])

  const navigate = (idx: number, col: number, dir: 'right' | 'left' | 'down' | 'up') => {
    navigating.current = true
    if (dir === 'right') {
      if (col < 1) inputRefs.current[idx]?.[1]?.focus()
      else if (idx < slots.length - 1) inputRefs.current[idx + 1]?.[0]?.focus()
      else { addSlot(); pendingFocus.current = [idx + 1, 0] }
    } else if (dir === 'left') {
      if (col > 0) inputRefs.current[idx]?.[0]?.focus()
      else if (idx > 0) inputRefs.current[idx - 1]?.[1]?.focus()
    } else if (dir === 'down') {
      if (idx < slots.length - 1) inputRefs.current[idx + 1]?.[col]?.focus()
      else { addSlot(); pendingFocus.current = [idx + 1, col] }
    } else if (dir === 'up') {
      if (idx > 0) inputRefs.current[idx - 1]?.[col]?.focus()
    }
  }

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

  const extraTotal = slots.reduce((s, slot) => {
    const n = parseInt(slot.amount)
    return s + (slot.name.trim() && !isNaN(n) ? n : 0)
  }, 0)

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
      <span className="w-24 text-right font-semibold text-gray-900 cursor-pointer hover:text-amber-700"
        onClick={() => startEdit(field)}>
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
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-amber-950">結帳表</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-amber-900">結帳日期</label>
          <input type="date" value={date}
            onChange={e => e.target.value && handleDateChange(e.target.value)}
            className="border border-amber-300 rounded-lg px-3 py-1.5 text-sm text-amber-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        {data && <span className="text-xs text-amber-500">比較 {data.yesterday} → {data.date}</span>}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-mono break-all mb-4">{error}</div>
      )}

      {loading ? (
        <div className="text-amber-700 text-center py-16">載入中...</div>
      ) : !data || data.rows.length === 0 ? (
        <div className="text-center text-amber-300 py-16 bg-white border border-amber-200 rounded-xl">
          請先在「刮刮樂」頁面新增種類
        </div>
      ) : (
        <div className="flex gap-6 items-start">

          {/* Left: main content */}
          <div className="flex-1 min-w-0 space-y-6">
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
                          <th className="border-b border-r border-amber-300 bg-amber-50 px-4 py-2 text-amber-900 font-bold text-left min-w-[80px]">欄位</th>
                          {rows.map(r => (
                            <th key={r.id} className="border-b border-r border-amber-200 bg-amber-100 px-3 py-1.5 text-amber-950 font-bold text-center min-w-[72px]">
                              {r.name}
                            </th>
                          ))}
                          <th className="border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700 font-bold text-center min-w-[72px]">小計</th>
                        </tr>
                      </thead>
                      <tbody>
                        {FIELDS.map((f, fi) => {
                          const rowTotal = rows.reduce((s, r) => s + r[f.key], 0)
                          const isSold = f.key === 'sold'
                          return (
                            <tr key={f.key} className={fi % 2 === 0 ? 'bg-white' : 'bg-amber-50/40'}>
                              <td className="border-b border-r border-amber-200 px-4 py-2 text-amber-900 font-semibold text-xs">{f.label}</td>
                              {rows.map(r => {
                                const v = r[f.key]
                                let cls = 'text-gray-700 font-medium'
                                if (f.key === 'supplement') cls = v > 0 ? 'text-green-600 font-medium' : v < 0 ? 'text-red-500 font-medium' : 'text-gray-400'
                                else if (isSold) cls = v > 0 ? 'text-gray-900 font-bold' : 'text-gray-400 font-bold'
                                return (
                                  <td key={r.id} className="border-b border-r border-amber-100 px-3 py-2 text-center">
                                    <span className={cls}>{f.key === 'supplement' && v > 0 ? `+${v}` : v}</span>
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
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-6 py-4 flex items-center gap-6">
              <span className="font-bold text-amber-950 text-base">總計</span>
              <span className="font-bold text-amber-950">{grandSheets} 張</span>
              <span className="text-amber-700 font-semibold">${grandTotal.toLocaleString()}</span>
            </div>

            {/* 彩券/刮刮樂/運彩 summary */}
            {(() => {
              const scratchNet = grandTotal - summary.scratchRedemption
              const lotteryNet = summary.lotterySales - summary.lotteryRedemption
              const sportsNet = summary.sportsSales - summary.sportsRedemption
              const grandNet = lotteryNet + scratchNet + sportsNet
              return (
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
                        <td className="border-b border-amber-100 px-4 py-2.5 text-center" rowSpan={3}><NetVal v={grandNet} /></td>
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
              )
            })()}
          </div>

          {/* Right: extra items panel */}
          <div className="w-56 flex-shrink-0">
            <div className="rounded-xl border border-amber-200 shadow-sm overflow-hidden sticky top-4">
              <div className="px-3 py-2.5 bg-amber-100 border-b border-amber-200 flex items-center justify-between">
                <span className="font-bold text-amber-950 text-sm">額外項目</span>
                {extraTotal !== 0 && (
                  <span className={`text-sm font-bold ${extraTotal >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    {extraTotal >= 0 ? '+' : ''}{extraTotal.toLocaleString()}
                  </span>
                )}
              </div>
              <datalist id="extra-names">
                {knownNames.map(n => <option key={n} value={n} />)}
              </datalist>
              <div className="divide-y divide-amber-100 bg-white">
                {slots.map((slot, idx) => {
                  if (!inputRefs.current[idx]) inputRefs.current[idx] = [null, null]
                  return (
                    <div key={idx} className="flex items-center gap-1 px-2 py-1.5">
                      <input
                        list="extra-names"
                        placeholder="項目"
                        className="flex-1 min-w-0 text-sm px-1.5 py-1 border border-transparent rounded focus:outline-none focus:border-amber-300 bg-transparent hover:bg-amber-50"
                        value={slot.name}
                        ref={el => { inputRefs.current[idx] = [el, inputRefs.current[idx]?.[1] ?? null] }}
                        onChange={e => updateSlot(idx, 'name', e.target.value)}
                        onBlur={() => saveSlot(idx)}
                        onKeyDown={e => {
                          if (e.key === 'Escape') { (e.target as HTMLInputElement).blur(); return }
                          if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); navigate(idx, 0, 'right') }
                          else if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); navigate(idx, 0, 'left') }
                          else if (e.key === 'ArrowDown') { e.preventDefault(); navigate(idx, 0, 'down') }
                          else if (e.key === 'ArrowUp') { e.preventDefault(); navigate(idx, 0, 'up') }
                          else if (e.key === 'ArrowRight') { e.preventDefault(); navigate(idx, 0, 'right') }
                        }}
                      />
                      <input
                        type="number"
                        placeholder="0"
                        className={`w-20 text-sm px-1.5 py-1 text-right border border-transparent rounded focus:outline-none focus:border-amber-300 bg-transparent hover:bg-amber-50 ${
                          parseInt(slot.amount) < 0 ? 'text-red-600 font-semibold' :
                          parseInt(slot.amount) > 0 ? 'text-gray-900 font-semibold' : 'text-gray-400'
                        }`}
                        value={slot.amount}
                        ref={el => { inputRefs.current[idx] = [inputRefs.current[idx]?.[0] ?? null, el] }}
                        onChange={e => updateSlot(idx, 'amount', e.target.value)}
                        onBlur={() => saveSlot(idx)}
                        onKeyDown={e => {
                          if (e.key === 'Escape') { (e.target as HTMLInputElement).blur(); return }
                          if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); navigate(idx, 1, 'right') }
                          else if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); navigate(idx, 1, 'left') }
                          else if (e.key === 'ArrowDown') { e.preventDefault(); navigate(idx, 1, 'down') }
                          else if (e.key === 'ArrowUp') { e.preventDefault(); navigate(idx, 1, 'up') }
                          else if (e.key === 'ArrowLeft') { e.preventDefault(); navigate(idx, 1, 'left') }
                        }}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="px-2 py-2 bg-amber-50 border-t border-amber-200">
                <button onClick={addSlot}
                  className="w-full py-1 text-xs text-amber-700 font-semibold hover:bg-amber-100 rounded-lg transition-colors">
                  ＋ 新增一列
                </button>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
