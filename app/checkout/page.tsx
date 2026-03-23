'use client'

import { useState, useEffect, useRef } from 'react'

type Row = {
  id: number; name: string; price: number; sheetsPerBook: number
  yesterdayDisplay: number; supplement: number; todayDisplay: number; sold: number
}
type CheckoutData = { date: string; yesterday: string; rows: Row[] }
type Summary = {
  lotterySales: number; lotteryRedemption: number
  scratchRedemption: number; sportsSales: number; sportsRedemption: number
  cash1000: number; cash500: number; cash100: number; cashCoins: number
}
type Slot = { id?: number; name: string; amount: string }
type TplItem = { id: number; name: string; amount: number }

const MIN_SLOTS = 8

function toTaipeiDateStr(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(d)
}

function buildSlots(items: { id: number; name: string; amount: number }[], tpl: TplItem[]): Slot[] {
  const savedByName = new Map(items.map(i => [i.name, i]))
  const tplNames = new Set(tpl.map(t => t.name))
  const result: Slot[] = []

  // Template items first — use saved value if exists, otherwise show name with empty amount
  for (const t of tpl) {
    const saved = savedByName.get(t.name)
    result.push(saved
      ? { id: saved.id, name: saved.name, amount: String(saved.amount) }
      : { name: t.name, amount: t.amount !== 0 ? String(t.amount) : '' }
    )
  }

  // Non-template saved items after
  for (const item of items) {
    if (!tplNames.has(item.name)) result.push({ id: item.id, name: item.name, amount: String(item.amount) })
  }

  while (result.length < MIN_SLOTS) result.push({ name: '', amount: '' })
  return result
}

export default function CheckoutPage() {
  const [date, setDate] = useState(toTaipeiDateStr(new Date()))
  const [data, setData] = useState<CheckoutData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary>({
    lotterySales: 0, lotteryRedemption: 0, scratchRedemption: 0, sportsSales: 0, sportsRedemption: 0,
    cash1000: 0, cash500: 0, cash100: 0, cashCoins: 0,
  })
  const [summaryEdits, setSummaryEdits] = useState<Partial<Record<keyof Summary, string>>>({})
  const [slots, setSlots] = useState<Slot[]>(buildSlots([], []))
  const [knownNames, setKnownNames] = useState<string[]>([])
  const [template, setTemplate] = useState<TplItem[]>([])
  const [showTplEditor, setShowTplEditor] = useState(false)
  const [tplNew, setTplNew] = useState({ name: '', amount: '' })
  const [ticketOrder, setTicketOrder] = useState<Record<number, number[]>>({})
  const inputRefs = useRef<(HTMLInputElement | null)[][]>([])
  const navigating = useRef(false)
  const pendingFocus = useRef<[number, number] | null>(null)
  const slotsRef = useRef(slots)
  slotsRef.current = slots

  useEffect(() => {
    if (pendingFocus.current) {
      const [r, c] = pendingFocus.current
      pendingFocus.current = null
      inputRefs.current[r]?.[c]?.focus()
    }
  }, [slots.length])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('floorInventoryTicketOrder')
      if (saved) setTicketOrder(JSON.parse(saved))
    } catch {}
  }, [])

  const loadTemplate = async () => {
    const res = await fetch('/api/extra-item-template')
    const tpl = await res.json()
    setTemplate(tpl)
    return tpl as TplItem[]
  }

  const load = async (d: string) => {
    setLoading(true); setError(null)
    try {
      const [checkoutRes, summaryRes, itemsRes, tpl] = await Promise.all([
        fetch(`/api/checkout?date=${d}`),
        fetch(`/api/daily-summary?date=${d}`),
        fetch(`/api/daily-summary-items?date=${d}`),
        loadTemplate(),
      ])
      const json = await checkoutRes.json()
      if (json.error) throw new Error(json.error)
      setData(json)
      const sd = await summaryRes.json()
      setSummary({ lotterySales: sd.lotterySales ?? 0, lotteryRedemption: sd.lotteryRedemption ?? 0, scratchRedemption: sd.scratchRedemption ?? 0, sportsSales: sd.sportsSales ?? 0, sportsRedemption: sd.sportsRedemption ?? 0, cash1000: sd.cash1000 ?? 0, cash500: sd.cash500 ?? 0, cash100: sd.cash100 ?? 0, cashCoins: sd.cashCoins ?? 0 })
      const itemsJson = await itemsRes.json()
      setSlots(buildSlots(itemsJson.items ?? [], tpl))
      setKnownNames(itemsJson.names ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(date) }, [])

  const handleDateChange = async (d: string) => {
    setDate(d)
    setLoading(true); setError(null)
    try {
      const [checkoutRes, summaryRes, itemsRes] = await Promise.all([
        fetch(`/api/checkout?date=${d}`),
        fetch(`/api/daily-summary?date=${d}`),
        fetch(`/api/daily-summary-items?date=${d}`),
      ])
      const json = await checkoutRes.json()
      if (json.error) throw new Error(json.error)
      setData(json)
      const sd = await summaryRes.json()
      setSummary({ lotterySales: sd.lotterySales ?? 0, lotteryRedemption: sd.lotteryRedemption ?? 0, scratchRedemption: sd.scratchRedemption ?? 0, sportsSales: sd.sportsSales ?? 0, sportsRedemption: sd.sportsRedemption ?? 0, cash1000: sd.cash1000 ?? 0, cash500: sd.cash500 ?? 0, cash100: sd.cash100 ?? 0, cashCoins: sd.cashCoins ?? 0 })
      const itemsJson = await itemsRes.json()
      setSlots(buildSlots(itemsJson.items ?? [], template))
      setKnownNames(itemsJson.names ?? [])
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }

  // Summary editing
  const getSummaryVal = (key: keyof Summary) =>
    key in summaryEdits ? summaryEdits[key]! : String(summary[key])

  const commitSummaryField = (key: keyof Summary) => {
    const raw = summaryEdits[key]
    if (raw === undefined) return
    const num = Math.max(0, parseInt(raw) || 0)
    const updated = { ...summary, [key]: num }
    setSummary(updated)
    setSummaryEdits(prev => { const next = { ...prev }; delete next[key]; return next })
    fetch('/api/daily-summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, ...updated }) })
  }

  // Slots
  const updateSlot = (idx: number, field: 'name' | 'amount', value: string) =>
    setSlots(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))

  const saveSlot = async (idx: number) => {
    if (navigating.current) { navigating.current = false; return }
    const slot = slotsRef.current[idx]
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
      fetch(`/api/daily-summary-items/${slot.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, amount }) })
      if (!knownNames.includes(name)) setKnownNames(prev => [...prev, name].sort())
    } else {
      const res = await fetch('/api/daily-summary-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, name, amount }) })
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
    } else if (idx > 0) inputRefs.current[idx - 1]?.[col]?.focus()
  }

  // Template CRUD
  const addTplItem = async () => {
    const name = tplNew.name.trim()
    if (!name) return
    const amount = parseInt(tplNew.amount) || 0
    const res = await fetch('/api/extra-item-template', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, amount }) })
    const item = await res.json()
    setTemplate(prev => [...prev, item])
    setTplNew({ name: '', amount: '' })
  }

  const updateTplItem = async (id: number, field: 'name' | 'amount', value: string) => {
    const parsed = field === 'amount' ? (parseInt(value) || 0) : value
    setTemplate(prev => prev.map(t => t.id === id ? { ...t, [field]: parsed } : t))
    fetch(`/api/extra-item-template/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: parsed }) })
  }

  const deleteTplItem = async (id: number) => {
    await fetch(`/api/extra-item-template/${id}`, { method: 'DELETE' })
    setTemplate(prev => prev.filter(t => t.id !== id))
  }

  // Computed
  const getOrderedRows = (price: number, rows: Row[]) => {
    const order = ticketOrder[price]
    if (!order) return rows
    return [...rows].sort((a, b) => {
      const ai = order.indexOf(a.id); const bi = order.indexOf(b.id)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
  }

  const grouped = data
    ? Object.entries(data.rows.reduce<Record<number, Row[]>>((acc, r) => {
        if (!acc[r.price]) acc[r.price] = []; acc[r.price].push(r); return acc
      }, {})).sort(([a], [b]) => parseInt(a) - parseInt(b))
    : []

  const FIELDS = [
    { key: 'yesterdayDisplay' as const, label: '昨日檯面' },
    { key: 'supplement' as const, label: '補張數' },
    { key: 'todayDisplay' as const, label: '今日檯面' },
    { key: 'sold' as const, label: '銷售張數' },
  ]

  const grandTotal = grouped.reduce((sum, [price, rows]) => sum + rows.reduce((s, r) => s + r.sold, 0) * parseInt(price), 0)
  const grandSheets = data ? data.rows.reduce((s, r) => s + r.sold, 0) : 0
  const extraTotal = slots.reduce((s, slot) => { const n = parseInt(slot.amount); return s + (slot.name.trim() && !isNaN(n) ? n : 0) }, 0)

  const lotteryNet = summary.lotterySales - summary.lotteryRedemption
  const scratchNet = grandTotal - summary.scratchRedemption
  const sportsNet = summary.sportsSales - summary.sportsRedemption
  const grandNet = lotteryNet + scratchNet + sportsNet
  const cashTotal = grandNet + extraTotal
  const actualCash = summary.cash1000 * 1000 + summary.cash500 * 500 + summary.cash100 * 100 + summary.cashCoins
  const diff = actualCash - cashTotal
  const totalRevenue = summary.lotterySales + grandTotal + summary.sportsSales
  const filledSlots = slots.filter(s => s.name.trim())

  const SummaryCell = ({ field }: { field: keyof Summary }) => (
    <input
      type="number" min="0"
      className="w-24 text-right font-semibold text-gray-900 focus:outline-none focus:border-b-2 focus:border-amber-400 bg-transparent"
      value={getSummaryVal(field)}
      onChange={e => setSummaryEdits(prev => ({ ...prev, [field]: e.target.value }))}
      onBlur={() => commitSummaryField(field)}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )

  const NetVal = ({ v }: { v: number }) => (
    <span className={`font-bold text-lg ${v > 0 ? 'text-gray-900' : v < 0 ? 'text-red-600' : 'text-gray-400'}`}>{v.toLocaleString()}</span>
  )

  return (
    <div>
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
        <button onClick={() => window.print()}
          className="ml-auto px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 print:hidden">
          列印
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-mono break-all mb-4">{error}</div>}

      {loading ? (
        <div className="text-amber-700 text-center py-16">載入中...</div>
      ) : !data || data.rows.length === 0 ? (
        <div className="text-center text-amber-300 py-16 bg-white border border-amber-200 rounded-xl">請先在「刮刮樂」頁面新增種類</div>
      ) : (
        <div className="flex gap-6 items-start">

          {/* Left */}
          <div className="flex-1 min-w-0 space-y-6">
            {grouped.map(([price, rows]) => {
              const priceNum = parseInt(price)
              const orderedRows = getOrderedRows(priceNum, rows)
              const totalSheets = rows.reduce((s, r) => s + r.sold, 0)
              const totalAmount = totalSheets * priceNum
              return (
                <div key={price}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">${priceNum.toLocaleString()}</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-amber-200 shadow-sm">
                    <table className="border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="border-b border-r border-amber-300 bg-amber-50 px-4 py-2 text-amber-900 font-bold text-left min-w-[80px]">欄位</th>
                          {orderedRows.map(r => (
                            <th key={r.id} className="border-b border-r border-amber-200 bg-amber-100 px-3 py-1.5 text-amber-950 font-bold text-center min-w-[72px]">{r.name}</th>
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
                              {orderedRows.map(r => {
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
                                ) : <span className="text-gray-500 font-medium">{rowTotal}</span>}
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

            {/* 刮刮樂總計 */}
            <div className="rounded-xl border border-amber-300 overflow-hidden">
              <table className="border-collapse text-sm w-full">
                <tbody>
                  <tr className="bg-amber-50">
                    <td className="border-r border-amber-300 px-4 py-2.5 font-bold text-amber-950">刮刮樂總計</td>
                    <td className="border-r border-amber-200 px-4 py-2.5 text-center font-bold text-amber-950">{grandSheets} 張</td>
                    <td className="px-4 py-2.5 text-center font-semibold text-amber-700">${grandTotal.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 銷售/兌獎/淨額 + 應有現金 */}
            <div className="rounded-xl border border-amber-200 shadow-sm overflow-hidden">
              <table className="border-collapse text-sm w-full">
                <thead>
                  <tr className="bg-amber-100">
                    <th className="border-b border-r border-amber-300 px-4 py-2 text-amber-900 font-bold text-left w-16"></th>
                    <th className="border-b border-r border-amber-200 px-4 py-2 text-amber-950 font-bold text-center">彩券</th>
                    <th className="border-b border-r border-amber-200 px-4 py-2 text-amber-950 font-bold text-center">刮刮樂</th>
                    <th className="border-b border-r border-amber-200 px-4 py-2 text-amber-950 font-bold text-center">運彩</th>
                    <th className="border-b border-amber-200 px-4 py-2 text-amber-950 font-bold text-center">小計</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    <td className="border-b border-r border-amber-200 px-4 py-2.5 text-amber-800 font-semibold text-xs">銷售</td>
                    <td className="border-b border-r border-amber-100 px-3 py-2 text-right"><SummaryCell field="lotterySales" /></td>
                    <td className="border-b border-r border-amber-100 px-3 py-2.5 text-right font-semibold text-gray-900">{grandTotal.toLocaleString()}</td>
                    <td className="border-b border-r border-amber-100 px-3 py-2 text-right"><SummaryCell field="sportsSales" /></td>
                    <td className="border-b border-amber-100 px-3 py-2.5 text-right font-semibold text-gray-700">{(summary.lotterySales + grandTotal + summary.sportsSales).toLocaleString()}</td>
                  </tr>
                  <tr className="bg-amber-50/40">
                    <td className="border-b border-r border-amber-200 px-4 py-2.5 text-amber-800 font-semibold text-xs">兌獎</td>
                    <td className="border-b border-r border-amber-100 px-3 py-2 text-right"><SummaryCell field="lotteryRedemption" /></td>
                    <td className="border-b border-r border-amber-100 px-3 py-2 text-right"><SummaryCell field="scratchRedemption" /></td>
                    <td className="border-b border-r border-amber-100 px-3 py-2 text-right"><SummaryCell field="sportsRedemption" /></td>
                    <td className="border-b border-amber-100 px-3 py-2.5 text-right font-semibold text-gray-700">{(summary.lotteryRedemption + summary.scratchRedemption + summary.sportsRedemption).toLocaleString()}</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="border-b border-r border-amber-200 px-4 py-2.5 text-amber-800 font-semibold text-xs">淨額</td>
                    <td className="border-b border-r border-amber-100 px-3 py-2.5 text-right"><NetVal v={lotteryNet} /></td>
                    <td className="border-b border-r border-amber-100 px-3 py-2.5 text-right"><NetVal v={scratchNet} /></td>
                    <td className="border-b border-r border-amber-100 px-3 py-2.5 text-right"><NetVal v={sportsNet} /></td>
                    <td className="border-b border-amber-100 px-3 py-2.5 text-right"><NetVal v={grandNet} /></td>
                  </tr>
                  <tr className="bg-amber-50/60">
                    <td className="border-r border-amber-200 px-4 py-2.5 text-amber-800 font-bold text-xs whitespace-nowrap">應有現金</td>
                    <td colSpan={3} className="border-r border-amber-100 px-3 py-2.5 text-right text-sm text-amber-700">
                      <span>淨額 <strong className={grandNet >= 0 ? 'text-gray-900' : 'text-red-600'}>{grandNet.toLocaleString()}</strong></span>
                      <span className="mx-2 text-amber-400">＋</span>
                      <span>額外 <strong className={extraTotal >= 0 ? 'text-gray-900' : 'text-red-600'}>{extraTotal >= 0 ? '+' : ''}{extraTotal.toLocaleString()}</strong></span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`text-xl font-bold ${cashTotal >= 0 ? 'text-amber-950' : 'text-red-600'}`}>{cashTotal.toLocaleString()}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 點鈔 */}
            <div className="rounded-xl border border-amber-200 shadow-sm overflow-hidden">
              <table className="border-collapse text-sm w-full">
                <thead>
                  <tr className="bg-amber-100">
                    <th className="border-b border-r border-amber-300 px-4 py-2 text-amber-900 font-bold text-left">點鈔</th>
                    <th className="border-b border-r border-amber-200 px-4 py-2 text-amber-950 font-bold text-center">1000</th>
                    <th className="border-b border-r border-amber-200 px-4 py-2 text-amber-950 font-bold text-center">500</th>
                    <th className="border-b border-r border-amber-200 px-4 py-2 text-amber-950 font-bold text-center">100</th>
                    <th className="border-b border-amber-200 px-4 py-2 text-amber-950 font-bold text-center">銅板</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    <td className="border-b border-r border-amber-200 px-4 py-2 text-amber-800 font-semibold text-xs">張數</td>
                    {(['cash1000', 'cash500', 'cash100'] as const).map(field => (
                      <td key={field} className="border-b border-r border-amber-100 px-2 py-1.5 text-center">
                        <input
                          type="number" min="0"
                          className="w-20 text-sm px-2 py-1 text-center border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                          value={getSummaryVal(field)}
                          onChange={e => setSummaryEdits(prev => ({ ...prev, [field]: e.target.value }))}
                          onBlur={() => commitSummaryField(field)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        />
                      </td>
                    ))}
                    <td className="border-b border-amber-100 px-2 py-1.5 text-center">
                      <input
                        type="number" min="0"
                        className="w-20 text-sm px-2 py-1 text-center border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                        value={getSummaryVal('cashCoins')}
                        onChange={e => setSummaryEdits(prev => ({ ...prev, cashCoins: e.target.value }))}
                        onBlur={() => commitSummaryField('cashCoins')}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      />
                    </td>
                  </tr>
                  <tr className="bg-amber-50/40">
                    <td className="border-r border-amber-200 px-4 py-2.5 text-amber-800 font-semibold text-xs">金額</td>
                    <td className="border-r border-amber-100 px-3 py-2.5 text-center font-semibold text-gray-700">{(summary.cash1000 * 1000).toLocaleString()}</td>
                    <td className="border-r border-amber-100 px-3 py-2.5 text-center font-semibold text-gray-700">{(summary.cash500 * 500).toLocaleString()}</td>
                    <td className="border-r border-amber-100 px-3 py-2.5 text-center font-semibold text-gray-700">{(summary.cash100 * 100).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-amber-500">（直接填金額）</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-amber-50 border-t-2 border-amber-300">
                    <td className="border-r border-amber-200 px-4 py-2.5 font-bold text-amber-900 text-xs">實際現金</td>
                    <td colSpan={2} className="border-r border-amber-100 px-3 py-2.5">
                      <span className="font-bold text-gray-900 text-base">{actualCash.toLocaleString()}</span>
                      <span className="ml-3 text-sm text-amber-700">差異</span>
                      <span className={`ml-1.5 font-bold text-base ${diff === 0 ? 'text-gray-400' : diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                      </span>
                    </td>
                    <td colSpan={2} className="px-3 py-2.5 text-right">
                      <span className="text-xs text-amber-700 mr-2">總營業額</span>
                      <span className="font-bold text-xl text-amber-950">{totalRevenue.toLocaleString()}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Right: extra items panel */}
          <div className="w-56 flex-shrink-0">
            <div className="rounded-xl border border-amber-200 shadow-sm overflow-hidden sticky top-4">

              {/* Header */}
              <div className="px-3 py-2.5 bg-amber-100 border-b border-amber-200 flex items-center justify-between">
                <span className="font-bold text-amber-950 text-sm">額外項目</span>
                <div className="flex items-center gap-2">
                  {extraTotal !== 0 && (
                    <span className={`text-sm font-bold ${extraTotal >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                      {extraTotal >= 0 ? '+' : ''}{extraTotal.toLocaleString()}
                    </span>
                  )}
                  <button
                    onClick={() => setShowTplEditor(v => !v)}
                    className={`text-xs px-2 py-0.5 rounded font-medium border transition-colors ${showTplEditor ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'}`}
                  >公版</button>
                </div>
              </div>

              {/* Template editor */}
              {showTplEditor && (
                <div className="border-b border-amber-200 bg-amber-50">
                  <div className="px-3 py-1.5 text-xs text-amber-700 font-semibold">公版設定（自動帶入新日期）</div>
                  <div className="divide-y divide-amber-100">
                    {template.map(t => (
                      <div key={t.id} className="flex items-center gap-1 px-2 py-1">
                        <input
                          className="flex-1 min-w-0 text-xs px-1.5 py-1 border border-amber-200 rounded bg-white focus:outline-none focus:border-amber-400"
                          defaultValue={t.name}
                          onBlur={e => updateTplItem(t.id, 'name', e.target.value)}
                        />
                        <input
                          type="number"
                          className="w-16 text-xs px-1.5 py-1 text-right border border-amber-200 rounded bg-white focus:outline-none focus:border-amber-400"
                          defaultValue={t.amount}
                          onBlur={e => updateTplItem(t.id, 'amount', e.target.value)}
                        />
                        <button onClick={() => deleteTplItem(t.id)} className="text-red-400 hover:text-red-600 text-xs font-bold px-1">×</button>
                      </div>
                    ))}
                    <div className="flex items-center gap-1 px-2 py-1.5">
                      <input
                        placeholder="項目名稱"
                        className="flex-1 min-w-0 text-xs px-1.5 py-1 border border-amber-300 rounded bg-white focus:outline-none focus:border-amber-400"
                        value={tplNew.name}
                        onChange={e => setTplNew(v => ({ ...v, name: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') addTplItem() }}
                      />
                      <input
                        type="number" placeholder="預設值"
                        className="w-16 text-xs px-1.5 py-1 text-right border border-amber-300 rounded bg-white focus:outline-none focus:border-amber-400"
                        value={tplNew.amount}
                        onChange={e => setTplNew(v => ({ ...v, amount: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') addTplItem() }}
                      />
                      <button onClick={addTplItem} className="text-amber-700 hover:text-amber-900 text-xs font-bold px-1">＋</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Slots */}
              <datalist id="extra-names">
                {knownNames.map(n => <option key={n} value={n} />)}
              </datalist>
              <div className="divide-y divide-amber-100 bg-white">
                {slots.map((slot, idx) => {
                  if (!inputRefs.current[idx]) inputRefs.current[idx] = [null, null]
                  return (
                    <div key={idx} className="flex items-center gap-1 px-2 py-1.5">
                      <input
                        list="extra-names" placeholder="項目"
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
                        type="number" placeholder="0"
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
                <button onClick={addSlot} className="w-full py-1 text-xs text-amber-700 font-semibold hover:bg-amber-100 rounded-lg transition-colors">
                  ＋ 新增一列
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── Print area ── */}
      {data && (
        <div id="print-area" style={{ display: 'none' }}>
          <div style={{ fontFamily: 'sans-serif', fontSize: '11px', color: '#000', lineHeight: 1.4 }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #000', paddingBottom: '3px', marginBottom: '5px' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>結帳表</span>
              <span style={{ fontSize: '11px' }}>{date}</span>
            </div>

            {/* ── 上半區：外框包住額外項目（左）＋ 刮刮樂（右）＋ 彙總表 ── */}
            <div style={{ border: '1px solid #000', marginBottom: '2px' }}>

              {/* 額外項目（左）＋ 刮刮樂（右）並排 */}
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>

                {/* 左：額外項目 */}
                {filledSlots.length > 0 && (
                  <div style={{ flexShrink: 0, borderRight: '1px solid #000', padding: '3px 5px' }}>
                    <div style={{ fontWeight: 'bold', borderBottom: '1px solid #aaa', marginBottom: '1px' }}>額外項目</div>
                    <table style={{ borderCollapse: 'collapse' }}>
                      <tbody>
                        {filledSlots.map((s, i) => {
                          const amt = parseInt(s.amount) || 0
                          return (
                            <tr key={i}>
                              <td style={{ paddingRight: '8px', whiteSpace: 'nowrap' }}>{s.name}</td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{amt > 0 ? '+' : ''}{amt.toLocaleString()}</td>
                            </tr>
                          )
                        })}
                        <tr style={{ borderTop: '1px solid #aaa', fontWeight: 'bold' }}>
                          <td style={{ paddingRight: '8px' }}>小計</td>
                          <td style={{ textAlign: 'right' }}>{extraTotal >= 0 ? '+' : ''}{extraTotal.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 右：刮刮樂各幣別 */}
                <div style={{ flex: 1, minWidth: 0, padding: '3px 5px' }}>
                  {grouped.map(([price, rows], gi) => {
                    const orderedRows = getOrderedRows(parseInt(price), rows)
                    const totalSold = rows.reduce((s, r) => s + r.sold, 0)
                    const totalAmt = totalSold * parseInt(price)
                    const p = '1px 3px'
                    return (
                      <div key={price} style={{ marginBottom: gi < grouped.length - 1 ? '4px' : 0 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '1px' }}>刮刮樂 ${parseInt(price).toLocaleString()}</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #aaa' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #aaa', background: '#f5f5f5' }}>
                              <th style={{ textAlign: 'left', padding: p }}>名稱</th>
                              <th style={{ textAlign: 'right', padding: p, borderLeft: '1px solid #ddd' }}>昨日</th>
                              <th style={{ textAlign: 'right', padding: p, borderLeft: '1px solid #ddd' }}>補張</th>
                              <th style={{ textAlign: 'right', padding: p, borderLeft: '1px solid #ddd' }}>今日</th>
                              <th style={{ textAlign: 'right', padding: p, borderLeft: '1px solid #aaa', fontWeight: 'bold' }}>銷售</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderedRows.map(r => (
                              <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: p }}>{r.name}</td>
                                <td style={{ textAlign: 'right', padding: p, color: '#555', borderLeft: '1px solid #eee' }}>{r.yesterdayDisplay}</td>
                                <td style={{ textAlign: 'right', padding: p, color: r.supplement > 0 ? '#000' : '#aaa', borderLeft: '1px solid #eee' }}>{r.supplement > 0 ? `+${r.supplement}` : r.supplement}</td>
                                <td style={{ textAlign: 'right', padding: p, color: '#555', borderLeft: '1px solid #eee' }}>{r.todayDisplay}</td>
                                <td style={{ textAlign: 'right', padding: p, fontWeight: 'bold', borderLeft: '1px solid #aaa' }}>{r.sold}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop: '1px solid #aaa', fontWeight: 'bold', background: '#f5f5f5' }}>
                              <td colSpan={4} style={{ padding: p }}>小計</td>
                              <td style={{ textAlign: 'right', padding: p, borderLeft: '1px solid #aaa' }}>{totalSold}張 ${totalAmt.toLocaleString()}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )
                  })}
                </div>

              </div>

              {/* 主彙總表：彩券/刮刮樂/運彩 × 銷售/兌獎/淨額，右側欄位 rowspan=3 */}
              {(() => {
                const C: React.CSSProperties = { padding: '2px 4px', borderRight: '1px solid #bbb' }
                const R: React.CSSProperties = { ...C, textAlign: 'right' }
                const RB: React.CSSProperties = { ...R, fontWeight: 'bold' }
                const Rlast: React.CSSProperties = { padding: '2px 4px', textAlign: 'right' }
                const label: React.CSSProperties = { padding: '2px 3px', color: '#555', whiteSpace: 'nowrap' }
                return (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #000', background: '#f5f5f5' }}>
                      <th colSpan={2} style={{ ...C, textAlign: 'center', fontWeight: 'bold' }}>彩券</th>
                      <th colSpan={2} style={{ ...C, textAlign: 'center', fontWeight: 'bold' }}>刮刮樂</th>
                      <th colSpan={2} style={{ ...C, textAlign: 'center', fontWeight: 'bold' }}>運彩</th>
                      <th style={{ ...C, textAlign: 'center', fontWeight: 'bold' }}>總計</th>
                      <th style={{ ...C, textAlign: 'center', fontWeight: 'bold' }}>應有現金</th>
                      <th style={{ ...C, textAlign: 'center', fontWeight: 'bold' }}>實際現金</th>
                      <th style={{ ...C, textAlign: 'center', fontWeight: 'bold' }}>差異</th>
                      <th style={{ ...Rlast, textAlign: 'center', fontWeight: 'bold' }}>額外</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 銷售 row */}
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <td style={label}>銷售</td>
                      <td style={R}>{summary.lotterySales.toLocaleString()}</td>
                      <td style={label}>銷售</td>
                      <td style={R}>{grandTotal.toLocaleString()}</td>
                      <td style={label}>銷售</td>
                      <td style={R}>{summary.sportsSales.toLocaleString()}</td>
                      <td style={{ ...RB, verticalAlign: 'middle' }} rowSpan={3}>{grandNet.toLocaleString()}</td>
                      <td style={{ ...RB, verticalAlign: 'middle' }} rowSpan={3}>{cashTotal.toLocaleString()}</td>
                      <td style={{ ...RB, verticalAlign: 'middle' }} rowSpan={3}>{actualCash.toLocaleString()}</td>
                      <td style={{ ...RB, verticalAlign: 'middle' }} rowSpan={3}>{diff > 0 ? '+' : ''}{diff.toLocaleString()}</td>
                      <td style={{ ...Rlast, verticalAlign: 'middle' }} rowSpan={3}>{extraTotal !== 0 ? (extraTotal > 0 ? '+' : '') + extraTotal.toLocaleString() : '—'}</td>
                    </tr>
                    {/* 兌獎 row */}
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <td style={label}>兌獎</td>
                      <td style={R}>{summary.lotteryRedemption.toLocaleString()}</td>
                      <td style={label}>兌獎</td>
                      <td style={R}>{summary.scratchRedemption.toLocaleString()}</td>
                      <td style={label}>兌獎</td>
                      <td style={R}>{summary.sportsRedemption.toLocaleString()}</td>
                    </tr>
                    {/* 淨額 row */}
                    <tr style={{ borderBottom: '2px solid #000', fontWeight: 'bold' }}>
                      <td style={label}>淨額</td>
                      <td style={R}>{lotteryNet.toLocaleString()}</td>
                      <td style={label}>淨額</td>
                      <td style={R}>{scratchNet.toLocaleString()}</td>
                      <td style={label}>淨額</td>
                      <td style={R}>{sportsNet.toLocaleString()}</td>
                    </tr>
                    {/* 點鈔 row */}
                    <tr>
                      <td style={label}>1000元</td>
                      <td style={R}>{summary.cash1000}</td>
                      <td style={label}>500元</td>
                      <td style={R}>{summary.cash500}</td>
                      <td style={label}>100元</td>
                      <td style={R}>{summary.cash100}</td>
                      <td style={{ ...C, color: '#555' }}>銅板</td>
                      <td style={R}>{summary.cashCoins.toLocaleString()}</td>
                      <td style={{ ...R, color: '#555' }}>實際現金</td>
                      <td style={{ ...Rlast, fontWeight: 'bold' }} colSpan={2}>
                        {actualCash.toLocaleString()}
                        <span style={{ marginLeft: '10px', color: '#555', fontWeight: 'normal' }}>總營業額</span>
                        <span style={{ marginLeft: '4px', fontWeight: 'bold' }}>{totalRevenue.toLocaleString()}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                )
              })()}

            </div>{/* end outer border box */}

          </div>
        </div>
      )}

      <style>{`
        @media print {
          @page { size: A5 portrait; margin: 6mm 4mm 6mm 24mm; }
          body { background: white !important; min-height: 0 !important; }
          nav { display: none !important; }
          main {
            height: 0 !important;
            overflow: hidden !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #print-area {
            display: block !important;
            position: absolute;
            top: 0; left: 0;
            width: 122mm;
            color: #000 !important;
            filter: grayscale(1);
          }
        }
      `}</style>
    </div>
  )
}
