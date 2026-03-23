'use client'

import { useState, useEffect, useRef } from 'react'

type Row = {
  id: number; name: string; price: number; sheetsPerBook: number
  yesterdayDisplay: number; supplement: number; restockSheets: number; todayDisplay: number; sold: number
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
  const result: Slot[] = []
  const usedIds = new Set<number>()

  // Template items first — match by name (first unused), otherwise show template default
  for (const t of tpl) {
    const saved = items.find(i => i.name === t.name && !usedIds.has(i.id))
    if (saved) {
      usedIds.add(saved.id)
      result.push({ id: saved.id, name: saved.name, amount: String(saved.amount) })
    } else {
      result.push({ name: t.name, amount: t.amount !== 0 ? String(t.amount) : '' })
    }
  }

  // All remaining saved items (including duplicates of template names)
  for (const item of items) {
    if (!usedIds.has(item.id)) result.push({ id: item.id, name: item.name, amount: String(item.amount) })
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
  const [restockModal, setRestockModal] = useState<{ ticketId: number; ticketName: string; current: number } | null>(null)
  const [restockInput, setRestockInput] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[][]>([])
  const navigating = useRef<'within' | 'cross' | false>(false)
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
    if (navigating.current === 'within') { navigating.current = false; return }
    navigating.current = false
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
    // 同列內移動（名稱↔金額）不需要存檔；跨列才存
    const withinRow = (dir === 'right' && col < 1) || (dir === 'left' && col > 0)
    navigating.current = withinRow ? 'within' : 'cross'
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

  const grandTotal = grouped.reduce((sum, [price, rows]) => sum + rows.reduce((s, r) => s + r.sold, 0) * parseInt(price), 0)
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

  const summaryInput = (field: keyof Summary) => (
    <input
      type="text" inputMode="numeric"
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

  const saveRestock = async () => {
    if (!restockModal) return
    const sheets = Math.max(0, parseInt(restockInput) || 0)
    await fetch('/api/floor-inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, scratchTicketId: restockModal.ticketId, restockSheets: sheets }),
    })
    setRestockModal(null)
    load(date)
  }

  return (
    <div>
      {/* 補進張數 modal */}
      {restockModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setRestockModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-72" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-amber-950 text-base">補進張數</h2>
              <button onClick={() => setRestockModal(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <p className="text-xs text-gray-500 mb-4">「{restockModal.ticketName}」今日從庫存補進現場的張數</p>
            <input
              type="number" min="0" autoFocus
              className="w-full border border-amber-300 rounded-xl px-4 py-2.5 text-center text-2xl font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-400 mb-4"
              value={restockInput}
              onChange={e => setRestockInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveRestock() }}
              placeholder="0"
            />
            <div className="flex gap-2">
              <button onClick={() => setRestockModal(null)} className="flex-1 px-4 py-2 border border-amber-200 text-amber-800 rounded-xl text-sm hover:bg-amber-50">取消</button>
              <button onClick={saveRestock} className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600">確認</button>
            </div>
          </div>
        </div>
      )}

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
        <div className="border border-amber-300 rounded-xl overflow-hidden bg-white shadow-sm">

          {/* === Row 1: 額外項目 (left) + 刮刮樂 (right) === */}
          <div className="flex flex-col sm:flex-row border-b border-amber-300">

            {/* Left: 額外項目 */}
            <div className="sm:flex-shrink-0 border-b sm:border-b-0 sm:border-r border-amber-300 p-3 sm:min-w-[150px]">
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-amber-200">
                <span className="font-bold text-amber-950 text-sm">額外項目</span>
                <div className="flex items-center gap-1.5">
                  {extraTotal !== 0 && (
                    <span className={`text-xs font-bold ${extraTotal >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                      {extraTotal >= 0 ? '+' : ''}{extraTotal.toLocaleString()}
                    </span>
                  )}
                  <button
                    onClick={() => setShowTplEditor(v => !v)}
                    className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${showTplEditor ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'}`}
                  >公版</button>
                </div>
              </div>

              {/* Template editor */}
              {showTplEditor && (
                <div className="mb-2 p-2 bg-amber-50 rounded border border-amber-200">
                  <div className="text-xs text-amber-700 font-semibold mb-1">公版設定</div>
                  <div className="divide-y divide-amber-100">
                    {template.map(t => (
                      <div key={t.id} className="flex items-center gap-1 py-0.5">
                        <input
                          className="flex-1 min-w-0 text-xs px-1.5 py-1 border border-amber-200 rounded bg-white focus:outline-none focus:border-amber-400"
                          defaultValue={t.name}
                          onBlur={e => updateTplItem(t.id, 'name', e.target.value)}
                        />
                        <input
                          type="text" inputMode="numeric"
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
              <table className="border-collapse text-sm w-full">
                <tbody>
                  {slots.map((slot, idx) => {
                    if (!inputRefs.current[idx]) inputRefs.current[idx] = [null, null]
                    return (
                      <tr key={idx}>
                        <td>
                          <input
                            list="extra-names" placeholder="項目"
                            className="w-full text-sm px-1 py-1 border border-transparent rounded focus:outline-none focus:border-amber-300 bg-transparent hover:bg-amber-50"
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
                              else if (e.key === 'ArrowRight') {
                                const inp = e.target as HTMLInputElement
                                if (inp.selectionStart === inp.value.length) { e.preventDefault(); navigate(idx, 0, 'right') }
                              }
                            }}
                          />
                        </td>
                        <td className="text-right">
                          <input
                            type="text" inputMode="numeric" placeholder="0"
                            className={`w-20 text-sm px-1 py-1 text-right border border-transparent rounded focus:outline-none focus:border-amber-300 bg-transparent hover:bg-amber-50 ${
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
                              else if (e.key === 'ArrowLeft') {
                                const inp = e.target as HTMLInputElement
                                if (inp.selectionStart === 0) { e.preventDefault(); navigate(idx, 1, 'left') }
                              }
                            }}
                          />
                        </td>
                      </tr>
                    )
                  })}
                  {filledSlots.length > 0 && (
                    <tr className="border-t border-amber-200 font-bold">
                      <td className="pt-1 text-xs text-amber-700 pl-1">小計</td>
                      <td className={`pt-1 text-right text-sm pr-1 ${extraTotal >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        {extraTotal >= 0 ? '+' : ''}{extraTotal.toLocaleString()}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <button onClick={addSlot} className="mt-1 w-full py-0.5 text-xs text-amber-600 hover:bg-amber-50 rounded transition-colors">
                ＋ 新增
              </button>
            </div>

            {/* Right: 刮刮樂 tables */}
            <div className="flex-1 min-w-0 p-3 space-y-3 overflow-x-auto">
              {grouped.map(([price, rows]) => {
                const priceNum = parseInt(price)
                const orderedRows = getOrderedRows(priceNum, rows)
                const totalSold = rows.reduce((s, r) => s + r.sold, 0)
                const totalAmt = totalSold * priceNum
                return (
                  <div key={price}>
                    <div className="font-bold text-amber-950 text-sm mb-1">刮刮樂 ${priceNum.toLocaleString()}</div>
                    <table className="border-collapse text-sm w-full border border-amber-200">
                      <thead>
                        <tr className="bg-amber-50 border-b border-amber-200">
                          <th className="text-left px-2 py-1 font-bold text-amber-900">名稱</th>
                          <th className="text-right px-2 py-1 border-l border-amber-200 font-semibold text-amber-700">昨日</th>
                          <th className="text-right px-2 py-1 border-l border-amber-200 font-semibold text-amber-700">補張</th>
                          <th className="text-right px-2 py-1 border-l border-amber-200 font-semibold text-amber-700">今日</th>
                          <th className="text-right px-2 py-1 border-l border-amber-300 font-bold text-amber-950">銷售</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderedRows.map(r => {
                          const effectiveSupplement = r.supplement + r.restockSheets
                          return (
                            <tr key={r.id} className="border-b border-amber-100 hover:bg-amber-50/40">
                              <td
                                className="px-2 py-1.5 font-medium cursor-pointer hover:text-amber-700"
                                onClick={() => { setRestockModal({ ticketId: r.id, ticketName: r.name, current: r.restockSheets }); setRestockInput(String(r.restockSheets || '')) }}
                                title="點擊記錄補進張數"
                              >
                                {r.name}
                                {r.restockSheets > 0 && <span className="ml-1 text-xs text-blue-500">+{r.restockSheets}</span>}
                              </td>
                              <td className="text-right px-2 py-1.5 text-gray-500 border-l border-amber-100">{r.yesterdayDisplay}</td>
                              <td className={`text-right px-2 py-1.5 border-l border-amber-100 ${effectiveSupplement > 0 ? 'text-green-600' : effectiveSupplement < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                {effectiveSupplement !== 0 ? (effectiveSupplement > 0 ? `+${effectiveSupplement}` : effectiveSupplement) : 0}
                              </td>
                              <td className="text-right px-2 py-1.5 text-gray-500 border-l border-amber-100">{r.todayDisplay}</td>
                              <td className={`text-right px-2 py-1.5 border-l border-amber-300 font-bold ${r.sold > 0 ? 'text-gray-900' : 'text-gray-400'}`}>{r.sold}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-amber-50 border-t border-amber-200 font-bold">
                          <td colSpan={4} className="px-2 py-1 text-amber-900 text-xs">小計</td>
                          <td className="text-right px-2 py-1 border-l border-amber-300 text-amber-950">{totalSold}張 ${totalAmt.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
              })}
            </div>
          </div>

          {/* === Main summary table === */}
          <div className="overflow-x-auto">
          <table className="border-collapse text-sm w-full min-w-[600px]">
            <thead>
              <tr className="bg-amber-50 border-b border-amber-300">
                <th className="px-2 py-2 border-r border-amber-200 w-10"></th>
                <th colSpan={2} className="px-3 py-2 border-r border-amber-200 text-center font-bold text-amber-950">彩券</th>
                <th colSpan={2} className="px-3 py-2 border-r border-amber-200 text-center font-bold text-amber-950">刮刮樂</th>
                <th colSpan={2} className="px-3 py-2 border-r border-amber-200 text-center font-bold text-amber-950">運彩</th>
                <th className="px-3 py-2 border-r border-amber-200 text-center font-bold text-amber-950">總計</th>
                <th className="px-3 py-2 border-r border-amber-200 text-center font-bold text-amber-950">應有現金</th>
                <th className="px-3 py-2 border-r border-amber-200 text-center font-bold text-amber-950">實際現金</th>
                <th className="px-3 py-2 text-center font-bold text-amber-950">差異</th>
              </tr>
            </thead>
            <tbody>
              {/* 銷售 */}
              <tr className="border-b border-amber-100">
                <td className="px-2 py-2 border-r border-amber-200 text-amber-600 text-xs font-semibold">銷售</td>
                <td className="px-1 py-1 border-r border-amber-100 text-xs text-amber-500 whitespace-nowrap">銷售</td>
                <td className="px-2 py-1 border-r border-amber-200 text-right">{summaryInput('lotterySales')}</td>
                <td className="px-1 py-1 border-r border-amber-100 text-xs text-amber-500">銷售</td>
                <td className="px-3 py-2 border-r border-amber-200 text-right font-semibold text-gray-900">{grandTotal.toLocaleString()}</td>
                <td className="px-1 py-1 border-r border-amber-100 text-xs text-amber-500">銷售</td>
                <td className="px-2 py-1 border-r border-amber-200 text-right">{summaryInput('sportsSales')}</td>
                <td className="px-3 py-2 border-r border-amber-200 text-right font-bold text-lg" rowSpan={3} style={{ verticalAlign: 'middle' }}><NetVal v={grandNet} /></td>
                <td className="px-3 py-2 border-r border-amber-200 text-right font-bold text-lg" rowSpan={3} style={{ verticalAlign: 'middle' }}>
                  <span className={`font-bold text-lg ${cashTotal >= 0 ? 'text-amber-950' : 'text-red-600'}`}>{cashTotal.toLocaleString()}</span>
                </td>
                <td className="px-3 py-2 border-r border-amber-200 text-right font-bold text-lg" rowSpan={3} style={{ verticalAlign: 'middle' }}>
                  <span className="font-bold text-lg text-gray-900">{actualCash.toLocaleString()}</span>
                </td>
                <td className="px-3 py-2 text-right" rowSpan={3} style={{ verticalAlign: 'middle' }}>
                  <span className={`font-bold text-lg ${diff === 0 ? 'text-gray-400' : diff > 0 ? 'text-green-600' : 'text-red-600'}`}>{diff > 0 ? '+' : ''}{diff.toLocaleString()}</span>
                </td>
              </tr>
              {/* 兌獎 */}
              <tr className="border-b border-amber-100">
                <td className="px-2 py-2 border-r border-amber-200 text-amber-600 text-xs font-semibold">兌獎</td>
                <td className="px-1 py-1 border-r border-amber-100 text-xs text-amber-500">兌獎</td>
                <td className="px-2 py-1 border-r border-amber-200 text-right">{summaryInput('lotteryRedemption')}</td>
                <td className="px-1 py-1 border-r border-amber-100 text-xs text-amber-500">兌獎</td>
                <td className="px-2 py-1 border-r border-amber-200 text-right">{summaryInput('scratchRedemption')}</td>
                <td className="px-1 py-1 border-r border-amber-100 text-xs text-amber-500">兌獎</td>
                <td className="px-2 py-1 border-r border-amber-200 text-right">{summaryInput('sportsRedemption')}</td>
              </tr>
              {/* 淨額 */}
              <tr className="border-b-2 border-amber-300 font-bold">
                <td className="px-2 py-2 border-r border-amber-200 text-amber-600 text-xs font-semibold">淨額</td>
                <td className="px-1 py-1 border-r border-amber-100 text-xs text-amber-500">淨額</td>
                <td className="px-3 py-2 border-r border-amber-200 text-right"><NetVal v={lotteryNet} /></td>
                <td className="px-1 py-1 border-r border-amber-100 text-xs text-amber-500">淨額</td>
                <td className="px-3 py-2 border-r border-amber-200 text-right"><NetVal v={scratchNet} /></td>
                <td className="px-1 py-1 border-r border-amber-100 text-xs text-amber-500">淨額</td>
                <td className="px-3 py-2 border-r border-amber-200 text-right"><NetVal v={sportsNet} /></td>
              </tr>
              {/* 點鈔 */}
              <tr className="bg-amber-50/60">
                <td className="px-2 py-2 border-r border-amber-200 text-amber-600 text-xs font-semibold whitespace-nowrap">點鈔</td>
                <td className="px-1 py-1 border-r border-amber-100 text-xs text-amber-500 whitespace-nowrap">1000元</td>
                <td className="px-1 py-1 border-r border-amber-200">
                  <input type="text" inputMode="numeric" className="w-16 text-sm px-1 py-0.5 text-center border border-amber-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white" value={getSummaryVal('cash1000')} onChange={e => setSummaryEdits(prev => ({ ...prev, cash1000: e.target.value }))} onBlur={() => commitSummaryField('cash1000')} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                </td>
                <td className="px-1 py-1 border-r border-amber-100 text-xs text-amber-500 whitespace-nowrap">500元</td>
                <td className="px-1 py-1 border-r border-amber-200">
                  <input type="text" inputMode="numeric" className="w-16 text-sm px-1 py-0.5 text-center border border-amber-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white" value={getSummaryVal('cash500')} onChange={e => setSummaryEdits(prev => ({ ...prev, cash500: e.target.value }))} onBlur={() => commitSummaryField('cash500')} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                </td>
                <td className="px-1 py-1 border-r border-amber-100 text-xs text-amber-500 whitespace-nowrap">100元</td>
                <td className="px-1 py-1 border-r border-amber-200">
                  <input type="text" inputMode="numeric" className="w-16 text-sm px-1 py-0.5 text-center border border-amber-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white" value={getSummaryVal('cash100')} onChange={e => setSummaryEdits(prev => ({ ...prev, cash100: e.target.value }))} onBlur={() => commitSummaryField('cash100')} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                </td>
                <td className="px-1 py-1 border-r border-amber-200 text-xs text-amber-500 whitespace-nowrap">銅板</td>
                <td className="px-1 py-1 border-r border-amber-200">
                  <input type="text" inputMode="numeric" className="w-20 text-sm px-1 py-0.5 text-center border border-amber-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white" value={getSummaryVal('cashCoins')} onChange={e => setSummaryEdits(prev => ({ ...prev, cashCoins: e.target.value }))} onBlur={() => commitSummaryField('cashCoins')} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                </td>
                <td colSpan={3} className="px-3 py-1.5 text-right whitespace-nowrap">
                  <span className="text-xs text-amber-700">總營業額</span>
                  <span className="ml-2 font-bold text-amber-950 text-lg">{totalRevenue.toLocaleString()}</span>
                </td>
              </tr>
            </tbody>
          </table>
          </div>

        </div>
      )}

      {/* ── Print area ── */}
      {data && (
        <div id="print-area" style={{ display: 'none' }}>
          <div style={{ fontFamily: 'sans-serif', fontSize: '10px', color: '#000', lineHeight: 1.25 }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #000', paddingBottom: '2px', marginBottom: '3px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold' }}>結帳表</span>
              <span style={{ fontSize: '10px' }}>{date}</span>
            </div>

            {/* ── 上半區：外框包住額外項目（左）＋ 刮刮樂（右）＋ 彙總表 ── */}
            <div style={{ border: '1px solid #000', marginBottom: '2px' }}>

              {/* 額外項目（左）＋ 刮刮樂（右）並排 */}
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>

                {/* 左：額外項目 */}
                {filledSlots.length > 0 && (
                  <div style={{ flexShrink: 0, borderRight: '1px solid #000', padding: '2px 4px' }}>
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
                <div style={{ flex: 1, minWidth: 0, padding: '2px 4px' }}>
                  {grouped.map(([price, rows], gi) => {
                    const orderedRows = getOrderedRows(parseInt(price), rows)
                    const totalSold = rows.reduce((s, r) => s + r.sold, 0)
                    const totalAmt = totalSold * parseInt(price)
                    const p = '0 2px'
                    return (
                      <div key={price} style={{ marginBottom: gi < grouped.length - 1 ? '2px' : 0 }}>
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
                const C: React.CSSProperties = { padding: '1px 3px', borderRight: '1px solid #bbb' }
                const R: React.CSSProperties = { ...C, textAlign: 'right' }
                const RB: React.CSSProperties = { ...R, fontWeight: 'bold' }
                const Rlast: React.CSSProperties = { padding: '1px 3px', textAlign: 'right' }
                const label: React.CSSProperties = { padding: '1px 2px', color: '#555', whiteSpace: 'nowrap' }
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
          @page { size: A5 portrait; margin: 4mm; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            min-height: 0 !important;
            background: white !important;
          }
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
            top: 8mm;
            left: 8mm;
            width: 132mm;
            color: #000 !important;
            filter: grayscale(1);
          }
        }
      `}</style>
    </div>
  )
}
