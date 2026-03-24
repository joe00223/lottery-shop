'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

type DayRow = {
  date: string
  lotterySales: number
  scratchSales: number
  scratchSheets: number
  sportsSales: number
  virtualSports: number
  extra: number
}
type ScratchBreakdown = {
  id: number; name: string; price: number
  soldSheets: number; soldAmount: number; commission: number
}
type MonthlyItem = { id: number; name: string; income: number; expense: number; note: string }
type Template = { id: number; name: string; income: number; expense: number; note: string }

const ITEM_COLS = ['name', 'income', 'expense', 'note'] as const
type ItemField = typeof ITEM_COLS[number]

function fmt(n: number) {
  if (n === 0) return <span className="text-gray-300">—</span>
  return <>{n.toLocaleString()}</>
}

export default function MonthlyPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rows, setRows] = useState<DayRow[]>([])
  const [scratchBreakdown, setScratchBreakdown] = useState<ScratchBreakdown[]>([])
  const [items, setItems] = useState<MonthlyItem[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [showTpl, setShowTpl] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Left table edit mode
  const [editMode, setEditMode] = useState(false)
  const [leftEdit, setLeftEdit] = useState<{ date: string; field: 'lotterySales' | 'sportsSales' | 'virtualSports'; value: string } | null>(null)
  type LeftField = 'lotterySales' | 'sportsSales' | 'virtualSports'
  const LEFT_FIELDS: LeftField[] = ['lotterySales', 'sportsSales', 'virtualSports']
  const leftRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Items table editing
  const [editCell, setEditCell] = useState<{ id: number; field: ItemField } | null>(null)
  const [editVal, setEditVal] = useState('')
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true)
    setError(null)
    setEditCell(null)
    try {
      const [reportRes, itemsRes, tplRes] = await Promise.all([
        fetch(`/api/monthly-report?year=${y}&month=${m}`),
        fetch(`/api/monthly-items?year=${y}&month=${m}`),
        fetch(`/api/monthly-item-template`),
      ])
      const report = await reportRes.json()
      let itemsData: MonthlyItem[] = await itemsRes.json()
      const tplData: Template[] = await tplRes.json()
      if (report.error) throw new Error(report.error)
      setRows(report.rows)
      setScratchBreakdown(report.scratchBreakdown ?? [])
      setTemplates(tplData)

      // Auto-populate from template if month has no items
      if (itemsData.length === 0 && tplData.length > 0) {
        const created = await Promise.all(
          tplData.map((t, i) => fetch('/api/monthly-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year: y, month: m, name: t.name, income: t.income, expense: t.expense, note: t.note, order: i }),
          }).then(r => r.json()))
        )
        itemsData = created
      }
      setItems(itemsData)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(year, month) }, [year, month])

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  // ── Left table editing ──
  const startLeftEdit = (date: string, field: LeftField) => {
    const row = rows.find(r => r.date === date)!
    setLeftEdit({ date, field, value: row[field] === 0 ? '' : String(row[field]) })
    setTimeout(() => leftRefs.current[`${date}-${field}`]?.focus(), 0)
  }

  const commitLeft = (date: string, field: LeftField, value: string, move?: { dr: number; dc: number }) => {
    const val = Math.max(0, parseInt(value) || 0)
    setRows(prev => prev.map(r => r.date === date ? { ...r, [field]: val } : r))
    fetch('/api/daily-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, [field]: val }),
    })
    if (!move) { setLeftEdit(null); return }
    const rowIdx = rows.findIndex(r => r.date === date)
    const colIdx = LEFT_FIELDS.indexOf(field)
    let nr = rowIdx + move.dr
    let nc = colIdx + move.dc
    if (nc >= LEFT_FIELDS.length) { nc = 0; nr++ }
    if (nc < 0) { nc = LEFT_FIELDS.length - 1; nr-- }
    if (nr >= 0 && nr < rows.length) {
      const nextDate = rows[nr].date
      const nextField = LEFT_FIELDS[nc]
      setLeftEdit({ date: nextDate, field: nextField, value: rows[nr][nextField] === 0 ? '' : String(rows[nr][nextField]) })
      setTimeout(() => leftRefs.current[`${nextDate}-${nextField}`]?.focus(), 0)
    } else {
      setLeftEdit(null)
    }
  }

  const leftCell = (date: string, field: LeftField, row: DayRow) => {
    const isActive = leftEdit?.date === date && leftEdit.field === field
    if (editMode) {
      return isActive ? (
        <input
          ref={el => { leftRefs.current[`${date}-${field}`] = el }}
          type="text" inputMode="numeric"
          className="w-full px-2 py-2 text-right text-sm bg-amber-100 focus:outline-none tabular-nums"
          value={leftEdit.value}
          onChange={e => setLeftEdit(c => c ? { ...c, value: e.target.value } : c)}
          onBlur={() => commitLeft(date, field, leftEdit.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') { setLeftEdit(null); return }
            if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); commitLeft(date, field, leftEdit.value, { dr: 0, dc: 1 }) }
            else if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); commitLeft(date, field, leftEdit.value, { dr: 0, dc: -1 }) }
            else if (e.key === 'ArrowDown') { e.preventDefault(); commitLeft(date, field, leftEdit.value, { dr: 1, dc: 0 }) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); commitLeft(date, field, leftEdit.value, { dr: -1, dc: 0 }) }
          }}
        />
      ) : (
        <span
          onClick={() => startLeftEdit(date, field)}
          className="block px-3 py-2 text-right tabular-nums cursor-pointer hover:bg-amber-100 w-full"
        >
          {row[field] > 0 ? row[field].toLocaleString() : <span className="text-gray-300">—</span>}
        </span>
      )
    }
    return <span className="block px-3 py-2 text-right tabular-nums">{fmt(row[field])}</span>
  }

  // ── Items table ──
  const startEdit = (id: number, field: ItemField, current: string | number) => {
    const val = (field === 'income' || field === 'expense')
      ? (current === 0 ? '' : String(current))
      : String(current)
    setEditCell({ id, field })
    setEditVal(val)
    // focus after state update
    setTimeout(() => cellRefs.current[`${id}-${field}`]?.focus(), 0)
  }

  const commitCell = (id: number, field: ItemField, value: string, move?: { dr: number; dc: number }) => {
    const isNum = field === 'income' || field === 'expense'
    const parsed: string | number = isNum ? Math.max(0, parseInt(value) || 0) : value
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: parsed } : it))
    fetch(`/api/monthly-items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: parsed }),
    })
    if (!move) { setEditCell(null); return }
    // Navigate
    const rowIdx = items.findIndex(it => it.id === id)
    const colIdx = ITEM_COLS.indexOf(field)
    let nr = rowIdx + move.dr
    let nc = colIdx + move.dc
    if (nc >= ITEM_COLS.length) { nc = 0; nr++ }
    if (nc < 0) { nc = ITEM_COLS.length - 1; nr-- }
    if (nr >= 0 && nr < items.length && nc >= 0 && nc < ITEM_COLS.length) {
      const nextItem = items[nr]
      const nextField = ITEM_COLS[nc]
      setEditCell({ id: nextItem.id, field: nextField })
      setEditVal(nextField === 'income' || nextField === 'expense'
        ? (nextItem[nextField] === 0 ? '' : String(nextItem[nextField]))
        : String(nextItem[nextField]))
      setTimeout(() => cellRefs.current[`${nextItem.id}-${nextField}`]?.focus(), 0)
    } else {
      setEditCell(null)
    }
  }

  const addItem = async () => {
    const res = await fetch('/api/monthly-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month, name: '', income: 0, expense: 0, note: '' }),
    })
    const newItem = await res.json()
    setItems(prev => [...prev, newItem])
    setTimeout(() => startEdit(newItem.id, 'name', ''), 50)
  }

  const deleteItem = async (id: number) => {
    setItems(prev => prev.filter(it => it.id !== id))
    await fetch(`/api/monthly-items/${id}`, { method: 'DELETE' })
  }

  // ── Template CRUD ──
  const addTpl = async () => {
    const res = await fetch('/api/monthly-item-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', income: 0, expense: 0, note: '' }),
    })
    const newTpl = await res.json()
    setTemplates(prev => [...prev, newTpl])
  }

  const updateTpl = async (id: number, field: keyof Template, value: string) => {
    const isNum = field === 'income' || field === 'expense'
    const parsed = isNum ? parseInt(value) || 0 : value
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, [field]: parsed } : t))
    await fetch(`/api/monthly-item-template/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: parsed }),
    })
  }

  const deleteTpl = async (id: number) => {
    setTemplates(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/monthly-item-template/${id}`, { method: 'DELETE' })
  }

  // ── Totals ──
  const total = rows.reduce((acc, r) => ({
    lotterySales: acc.lotterySales + r.lotterySales,
    scratchSales: acc.scratchSales + r.scratchSales,
    sportsSales: acc.sportsSales + r.sportsSales,
    virtualSports: acc.virtualSports + r.virtualSports,
  }), { lotterySales: 0, scratchSales: 0, sportsSales: 0, virtualSports: 0 })

  const totalRevenue = (r: DayRow) => r.lotterySales + r.scratchSales + r.sportsSales + r.virtualSports
  const grandRevenue = total.lotterySales + total.scratchSales + total.sportsSales + total.virtualSports

  // Commission rows (fixed)
  const fixedItems = [
    { id: -1, name: '彩券傭金', income: Math.round(total.lotterySales * 0.08), expense: 0, note: `${total.lotterySales.toLocaleString()} × 8%`, fixed: true },
    { id: -2, name: '刮刮樂傭金', income: Math.round(total.scratchSales * 0.09), expense: 0, note: `${total.scratchSales.toLocaleString()} × 9%`, fixed: true },
    { id: -3, name: '運彩傭金', income: Math.round((total.sportsSales + total.virtualSports) * 0.0625), expense: 0, note: `${(total.sportsSales + total.virtualSports).toLocaleString()} × 6.25%`, fixed: true },
  ]
  const allItems = [...fixedItems, ...items.map(it => ({ ...it, fixed: false }))]
  const commTotalIncome = allItems.reduce((s, it) => s + it.income, 0)
  const commTotalExpense = allItems.reduce((s, it) => s + it.expense, 0)

  // Scratch totals from daily rows
  const scratchTotalSheets = rows.reduce((s, r) => s + r.scratchSheets, 0)

  const weekDay = ['日', '一', '二', '三', '四', '五', '六']

  const cellInput = (id: number, field: ItemField, placeholder: string, align: 'left' | 'right' = 'left') => {
    const isActive = editCell?.id === id && editCell.field === field
    const item = items.find(it => it.id === id)!
    const displayVal = item[field]
    const isNum = field === 'income' || field === 'expense'
    return isActive ? (
      <input
        ref={el => { cellRefs.current[`${id}-${field}`] = el }}
        type="text" inputMode={isNum ? 'numeric' : 'text'}
        className={`w-full px-3 py-2 text-sm bg-amber-100 focus:outline-none ${align === 'right' ? 'text-right' : ''}`}
        value={editVal}
        onChange={e => setEditVal(e.target.value)}
        onBlur={() => commitCell(id, field, editVal)}
        onKeyDown={e => {
          if (e.key === 'Escape') { setEditCell(null); return }
          if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); commitCell(id, field, editVal, { dr: 0, dc: 1 }) }
          else if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); commitCell(id, field, editVal, { dr: 0, dc: -1 }) }
          else if (e.key === 'ArrowDown') { e.preventDefault(); commitCell(id, field, editVal, { dr: 1, dc: 0 }) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); commitCell(id, field, editVal, { dr: -1, dc: 0 }) }
        }}
      />
    ) : (
      <span
        onClick={() => startEdit(id, field, displayVal)}
        className={`block px-3 py-2 cursor-pointer hover:bg-amber-50 min-w-[60px] ${align === 'right' ? 'text-right' : ''}`}
      >
        {isNum
          ? (displayVal as number) > 0 ? (displayVal as number).toLocaleString() : <span className="text-gray-300">—</span>
          : displayVal || <span className="text-gray-300">{placeholder}</span>
        }
      </span>
    )
  }

  return (
    <div>
      <style>{`
        #monthly-print { display: none; }
        @media print {
          body * { visibility: hidden; }
          #monthly-print { display: block; }
          #monthly-print, #monthly-print * { visibility: visible; }
          #monthly-print { position: fixed; top: 0; left: 0; width: 100%; }
          @page { size: A4 portrait; margin: 10mm; }
        }
      `}</style>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-amber-950">月報表</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="px-3 py-1.5 rounded bg-white border border-amber-300 text-sm font-medium text-amber-900 hover:bg-amber-50">← 上月</button>
          <span className="text-amber-950 font-semibold text-lg min-w-[7rem] text-center">{year} / {String(month).padStart(2, '0')}</span>
          <button onClick={nextMonth} className="px-3 py-1.5 rounded bg-white border border-amber-300 text-sm font-medium text-amber-900 hover:bg-amber-50">下月 →</button>
        </div>
        {loading && <span className="text-amber-400 text-sm">載入中...</span>}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded text-sm font-semibold border bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          >列印</button>
          <button
            onClick={() => { setEditMode(v => !v); setLeftEdit(null) }}
            className={`px-3 py-1.5 rounded text-sm font-semibold border transition-colors ${editMode ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'}`}
          >
            {editMode ? '✓ 編輯中' : '編輯'}
          </button>
        </div>
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
                  return (
                    <tr key={r.date} className={`border-b border-amber-100 ${!hasData && !editMode ? 'opacity-30' : i % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}`}>
                      <td className={`px-3 py-2 border-r border-amber-200 font-medium sticky left-0 z-10 whitespace-nowrap text-xs
                        ${!hasData && !editMode ? 'bg-white' : i % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}
                        ${dow === 0 ? 'text-red-600' : dow === 6 ? 'text-blue-600' : 'text-gray-800'}`}>
                        {r.date.slice(5)} ({weekDay[dow]})
                      </td>
                      <td className="px-0 py-0 border-r border-amber-100">{leftCell(r.date, 'lotterySales', r)}</td>
                      <td className="px-3 py-2 border-r border-amber-100 text-right tabular-nums">{fmt(r.scratchSales)}</td>
                      <td className="px-0 py-0 border-r border-amber-100">{leftCell(r.date, 'sportsSales', r)}</td>
                      <td className="px-0 py-0 border-r border-amber-100">{leftCell(r.date, 'virtualSports', r)}</td>
                      <td className={`px-3 py-2 text-right font-bold tabular-nums ${rev > 0 ? 'text-amber-900' : 'text-gray-300'}`}>
                        {(hasData || editMode) && rev > 0 ? rev.toLocaleString() : '—'}
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

          {/* ── 右側欄 ── */}
          <div className="flex flex-col gap-6 w-full xl:w-auto xl:min-w-[460px]">

            {/* 傭金/項目表 */}
            <div className="rounded-xl border border-amber-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-amber-100 border-b-2 border-amber-300">
                <span className="font-bold text-amber-900 text-sm">項目明細</span>
                <button
                  onClick={() => setShowTpl(v => !v)}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${showTpl ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'}`}
                >公版</button>
              </div>

              {/* Template editor */}
              {showTpl && (
                <div className="bg-amber-50 border-b border-amber-200 p-3">
                  <div className="text-xs text-amber-700 font-semibold mb-2">公版設定（新月份自動套用）</div>
                  <table className="border-collapse text-xs w-full">
                    <thead>
                      <tr className="text-amber-600">
                        <th className="text-left pb-1 pr-2">項目</th>
                        <th className="text-right pb-1 pr-2 w-20">收入</th>
                        <th className="text-right pb-1 pr-2 w-20">支出</th>
                        <th className="text-left pb-1 pr-2">備註</th>
                        <th className="w-5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {templates.map(t => (
                        <tr key={t.id}>
                          <td className="py-0.5 pr-2"><input className="w-full text-xs px-1.5 py-1 border border-amber-200 rounded bg-white focus:outline-none focus:border-amber-400" defaultValue={t.name} onBlur={e => updateTpl(t.id, 'name', e.target.value)} placeholder="項目名稱" /></td>
                          <td className="py-0.5 pr-2"><input type="text" inputMode="numeric" className="w-full text-xs px-1.5 py-1 text-right border border-amber-200 rounded bg-white focus:outline-none focus:border-amber-400" defaultValue={t.income || ''} onBlur={e => updateTpl(t.id, 'income', e.target.value)} placeholder="0" /></td>
                          <td className="py-0.5 pr-2"><input type="text" inputMode="numeric" className="w-full text-xs px-1.5 py-1 text-right border border-amber-200 rounded bg-white focus:outline-none focus:border-amber-400" defaultValue={t.expense || ''} onBlur={e => updateTpl(t.id, 'expense', e.target.value)} placeholder="0" /></td>
                          <td className="py-0.5 pr-2"><input className="w-full text-xs px-1.5 py-1 border border-amber-200 rounded bg-white focus:outline-none focus:border-amber-400" defaultValue={t.note} onBlur={e => updateTpl(t.id, 'note', e.target.value)} placeholder="備註" /></td>
                          <td className="py-0.5 text-center"><button onClick={() => deleteTpl(t.id)} className="text-red-300 hover:text-red-600 font-bold">×</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button onClick={addTpl} className="mt-2 w-full py-1 text-xs text-amber-600 hover:bg-amber-100 rounded transition-colors">＋ 新增公版項目</button>
                </div>
              )}

              <table className="border-collapse text-sm w-full">
                <thead>
                  <tr className="bg-amber-50 border-b border-amber-200 text-amber-700 text-xs font-semibold">
                    <th className="px-3 py-2 border-r border-amber-100 text-left">項目</th>
                    <th className="px-3 py-2 border-r border-amber-100 text-right">收入</th>
                    <th className="px-3 py-2 border-r border-amber-100 text-right">支出</th>
                    <th className="px-3 py-2 text-left">備註</th>
                    <th className="w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {allItems.map((it, i) => (
                    <tr key={it.id} className={`border-b border-amber-100 ${i % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}`}>
                      <td className="px-0 py-0 border-r border-amber-100">
                        {it.fixed
                          ? <span className="block px-3 py-2 text-amber-900 font-medium whitespace-nowrap">{it.name}</span>
                          : cellInput(it.id, 'name', '項目名稱')}
                      </td>
                      <td className="px-0 py-0 border-r border-amber-100 text-right">
                        {it.fixed
                          ? <span className="block px-3 py-2 text-green-700 font-semibold">{it.income > 0 ? it.income.toLocaleString() : '—'}</span>
                          : cellInput(it.id, 'income', '—', 'right')}
                      </td>
                      <td className="px-0 py-0 border-r border-amber-100 text-right">
                        {it.fixed
                          ? <span className="block px-3 py-2 text-gray-300">—</span>
                          : cellInput(it.id, 'expense', '—', 'right')}
                      </td>
                      <td className="px-0 py-0">
                        {it.fixed
                          ? <span className="block px-3 py-2 text-xs text-amber-600">{it.note}</span>
                          : cellInput(it.id, 'note', '備註')}
                      </td>
                      <td className="px-1 text-center">
                        {!it.fixed && <button onClick={() => deleteItem(it.id)} className="text-red-300 hover:text-red-600 text-xs font-bold">×</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-amber-100 border-t-2 border-amber-400 font-bold">
                    <td className="px-3 py-2 text-amber-950">合計</td>
                    <td className="px-3 py-2 text-right tabular-nums text-green-700">{commTotalIncome > 0 ? commTotalIncome.toLocaleString() : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-600">{commTotalExpense > 0 ? commTotalExpense.toLocaleString() : '—'}</td>
                    <td colSpan={2} className="px-3 py-2 text-right tabular-nums">
                      {commTotalIncome - commTotalExpense !== 0 && (
                        <span className={commTotalIncome >= commTotalExpense ? 'text-green-700' : 'text-red-600'}>
                          淨 {commTotalIncome - commTotalExpense > 0 ? '+' : ''}{(commTotalIncome - commTotalExpense).toLocaleString()}
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr className="bg-white">
                    <td colSpan={5} className="px-2 py-1">
                      <button onClick={addItem} className="w-full py-1 text-xs text-amber-600 hover:bg-amber-50 rounded transition-colors">＋ 新增項目</button>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 刮刮樂明細表 */}
            <div className="rounded-xl border border-amber-200 shadow-sm overflow-hidden">
              <div className="px-3 py-2 bg-amber-100 border-b-2 border-amber-300">
                <span className="font-bold text-amber-900 text-sm">刮刮樂明細</span>
              </div>
              <table className="border-collapse text-sm w-full">
                <thead>
                  <tr className="bg-amber-50 border-b border-amber-200 text-amber-700 text-xs font-semibold">
                    <th className="px-3 py-2 border-r border-amber-100 text-right">月總張數</th>
                    <th className="px-3 py-2 border-r border-amber-100 text-right">收入</th>
                    <th className="px-3 py-2 text-right">傭金 (9%)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    <td className="px-3 py-2.5 border-r border-amber-100 text-right tabular-nums font-semibold">{scratchTotalSheets.toLocaleString()}</td>
                    <td className="px-3 py-2.5 border-r border-amber-100 text-right tabular-nums font-semibold">{total.scratchSales.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-green-700 font-semibold">{Math.round(total.scratchSales * 0.09).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* ── 列印版面（螢幕隱藏，列印顯示）── */}
      {!loading && (
        <div id="monthly-print" style={{ fontFamily: 'sans-serif', fontSize: '9px' }}>
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13px', marginBottom: '6px' }}>
            {year} 年 {String(month).padStart(2, '0')} 月　月報表
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            {/* 左：每日銷售 */}
            <table style={{ borderCollapse: 'collapse', flex: '1 1 0', minWidth: 0 }}>
              <thead>
                <tr style={{ background: '#eee', borderBottom: '2px solid #000' }}>
                  {['日期','彩券','刮刮樂','運彩','虛擬運彩','總營業額'].map(h => (
                    <th key={h} style={{ border: '1px solid #999', padding: '2px 4px', textAlign: h === '日期' ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const rev = totalRevenue(r)
                  const d = new Date(r.date + 'T12:00:00')
                  const dow = d.getDay()
                  const hasData = r.lotterySales || r.scratchSales || r.sportsSales || r.virtualSports
                  return (
                    <tr key={r.date} style={{ opacity: hasData ? 1 : 0.3 }}>
                      <td style={{ border: '1px solid #bbb', padding: '1px 3px', whiteSpace: 'nowrap', color: dow === 0 ? '#c00' : dow === 6 ? '#00c' : '#000' }}>
                        {r.date.slice(5)}({weekDay[dow]})
                      </td>
                      {[r.lotterySales, r.scratchSales, r.sportsSales, r.virtualSports].map((v, i) => (
                        <td key={i} style={{ border: '1px solid #bbb', padding: '1px 4px', textAlign: 'right' }}>{v > 0 ? v.toLocaleString() : '—'}</td>
                      ))}
                      <td style={{ border: '1px solid #bbb', padding: '1px 4px', textAlign: 'right', fontWeight: 'bold' }}>{rev > 0 ? rev.toLocaleString() : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#eee', borderTop: '2px solid #000', fontWeight: 'bold' }}>
                  <td style={{ border: '1px solid #999', padding: '2px 3px' }}>月合計</td>
                  {[total.lotterySales, total.scratchSales, total.sportsSales, total.virtualSports].map((v, i) => (
                    <td key={i} style={{ border: '1px solid #999', padding: '2px 4px', textAlign: 'right' }}>{v > 0 ? v.toLocaleString() : '—'}</td>
                  ))}
                  <td style={{ border: '1px solid #999', padding: '2px 4px', textAlign: 'right', fontWeight: 'bold' }}>{grandRevenue > 0 ? grandRevenue.toLocaleString() : '—'}</td>
                </tr>
              </tfoot>
            </table>

            {/* 右：項目明細 + 刮刮樂 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '200px', flexShrink: 0 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr style={{ background: '#eee', borderBottom: '2px solid #000' }}>
                    {['項目','收入','支出','備註'].map(h => (
                      <th key={h} style={{ border: '1px solid #999', padding: '2px 3px', textAlign: h === '項目' || h === '備註' ? 'left' : 'right' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allItems.map(it => (
                    <tr key={it.id}>
                      <td style={{ border: '1px solid #bbb', padding: '1px 3px', whiteSpace: 'nowrap', fontWeight: it.fixed ? 'bold' : 'normal' }}>{it.name}</td>
                      <td style={{ border: '1px solid #bbb', padding: '1px 3px', textAlign: 'right' }}>{it.income > 0 ? it.income.toLocaleString() : '—'}</td>
                      <td style={{ border: '1px solid #bbb', padding: '1px 3px', textAlign: 'right' }}>{it.expense > 0 ? it.expense.toLocaleString() : '—'}</td>
                      <td style={{ border: '1px solid #bbb', padding: '1px 3px', fontSize: '8px', color: '#555' }}>{it.note}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#eee', borderTop: '2px solid #000', fontWeight: 'bold' }}>
                    <td style={{ border: '1px solid #999', padding: '2px 3px' }}>合計</td>
                    <td style={{ border: '1px solid #999', padding: '2px 3px', textAlign: 'right' }}>{commTotalIncome > 0 ? commTotalIncome.toLocaleString() : '—'}</td>
                    <td style={{ border: '1px solid #999', padding: '2px 3px', textAlign: 'right' }}>{commTotalExpense > 0 ? commTotalExpense.toLocaleString() : '—'}</td>
                    <td style={{ border: '1px solid #999', padding: '2px 3px', textAlign: 'right' }}>
                      {commTotalIncome - commTotalExpense !== 0 && `淨 ${commTotalIncome - commTotalExpense > 0 ? '+' : ''}${(commTotalIncome - commTotalExpense).toLocaleString()}`}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr style={{ background: '#eee', borderBottom: '2px solid #000' }}>
                    <th style={{ border: '1px solid #999', padding: '2px 3px', textAlign: 'center' }} colSpan={2}>刮刮樂明細</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #bbb', padding: '1px 3px' }}>月總張數</td>
                    <td style={{ border: '1px solid #bbb', padding: '1px 3px', textAlign: 'right', fontWeight: 'bold' }}>{scratchTotalSheets.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #bbb', padding: '1px 3px' }}>收入</td>
                    <td style={{ border: '1px solid #bbb', padding: '1px 3px', textAlign: 'right', fontWeight: 'bold' }}>{total.scratchSales.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #bbb', padding: '1px 3px' }}>傭金 (9%)</td>
                    <td style={{ border: '1px solid #bbb', padding: '1px 3px', textAlign: 'right', fontWeight: 'bold' }}>{Math.round(total.scratchSales * 0.09).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
