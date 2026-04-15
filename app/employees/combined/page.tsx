'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Employee = { id: number; name: string; color: string }
type Shift = { date: string; dayName: string; startTime: string; endTime: string; hours: number }

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10)
}
function formatPrintDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${parseInt(m)}月${parseInt(d)}日`
}

// ── Single salary slip (used twice) ──────────────────────────────────────────
type SlipProps = {
  label: string
  employees: Employee[]
  empId: number | null
  setEmpId: (id: number | null) => void
  shifts: Shift[]
  totalHours: number
  loading: boolean
  hourlyRate: string
  setHourlyRate: (v: string) => void
  adjustments: Record<number, string>
  setAdjustments: (fn: (prev: Record<number, string>) => Record<number, string>) => void
  start: string
  end: string
}

function Slip({
  label, employees, empId, setEmpId,
  shifts, totalHours, loading,
  hourlyRate, setHourlyRate,
  adjustments, setAdjustments,
  start, end,
}: SlipProps) {
  const emp = employees.find(e => e.id === empId)
  const rate = parseFloat(hourlyRate) || 0
  const totalAdj = Object.values(adjustments).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const basePay = totalHours * rate
  const finalPay = basePay + totalAdj

  return (
    <div className="slip flex-1 bg-white border-2 border-black rounded-xl print:rounded-none p-5 print:p-0 shadow-sm print:shadow-none print:border-black">
      {/* 員工選擇（螢幕用） */}
      <div className="print:hidden mb-3">
        <label className="text-xs font-semibold text-gray-500 mr-2">{label}</label>
        <select
          value={empId ?? ''}
          onChange={e => setEmpId(e.target.value ? parseInt(e.target.value) : null)}
          className="border border-amber-300 rounded-lg px-2 py-1 text-sm text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
        >
          <option value="">— 選擇員工 —</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>

      {/* 薪資單標題 */}
      <div className="text-center border-b-2 border-black pb-2 mb-2">
        <div className="font-bold text-base tracking-wide">
          {emp ? emp.name : <span className="text-gray-400">（未選擇）</span>}　薪資單
        </div>
        <div className="text-xs mt-0.5">{formatPrintDate(start)}　至　{formatPrintDate(end)}</div>
      </div>

      {/* 班次表 */}
      {loading ? (
        <div className="text-center text-xs text-gray-400 py-4">載入中...</div>
      ) : !empId ? (
        <div className="text-center text-xs text-gray-300 py-4">請選擇員工</div>
      ) : shifts.length === 0 ? (
        <div className="text-center text-xs text-gray-300 py-4">此時段無排班紀錄</div>
      ) : (
        <table className="w-full text-xs border-collapse mb-2">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-1 font-bold">日期</th>
              <th className="text-center py-1 font-bold w-8">星期</th>
              <th className="text-left py-1 font-bold print:hidden">時段</th>
              <th className="text-center py-1 font-bold w-8">時數</th>
              <th className="text-center py-1 font-bold">調整</th>
              <th className="text-right py-1 font-bold">小計</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s, i) => {
              const adj = parseFloat(adjustments[i] ?? '') || 0
              const pay = s.hours * rate + adj
              return (
                <tr key={i} className="border-b border-gray-200">
                  <td className="py-0.5 font-medium">{s.date}</td>
                  <td className="py-0.5 text-center text-gray-500">{s.dayName}</td>
                  <td className="py-0.5 text-gray-600 print:hidden">{s.startTime}–{s.endTime}</td>
                  <td className="py-0.5 text-center font-semibold">{s.hours}h</td>
                  <td className="py-0.5 text-center">
                    <input
                      type="number"
                      value={adjustments[i] ?? ''}
                      onChange={e => setAdjustments(prev => ({ ...prev, [i]: e.target.value }))}
                      placeholder="0"
                      className="w-full text-center border border-gray-400 rounded px-0.5 py-px text-xs focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </td>
                  <td className="py-0.5 text-right font-medium">
                    {rate > 0 ? `$${pay % 1 === 0 ? pay : pay.toFixed(1)}` : adj !== 0 ? `$${adj}` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* 薪資合計區 */}
      <div className="border-t-2 border-black pt-2 mt-1">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-bold">時薪 $</span>
          <input
            type="number"
            value={hourlyRate}
            onChange={e => setHourlyRate(e.target.value)}
            placeholder="輸入時薪"
            className="border-b-2 border-black w-20 text-center py-px text-xs font-semibold focus:outline-none bg-transparent"
          />
          <span className="text-xs text-gray-400">/ 時</span>
        </div>
        <div className="space-y-0.5 text-xs text-right">
          <div className="flex justify-between">
            <span className="text-gray-500">總時數</span>
            <span className="font-semibold">{totalHours} h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">底薪</span>
            <span className="font-semibold">{rate > 0 ? `$${basePay % 1 === 0 ? basePay : basePay.toFixed(1)}` : '—'}</span>
          </div>
          {totalAdj !== 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">調整</span>
              <span className="font-semibold">{totalAdj > 0 ? `+$${totalAdj}` : `-$${Math.abs(totalAdj)}`}</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t-2 border-black pt-1">
            <span>實領</span>
            <span>{rate > 0 ? `$${finalPay % 1 === 0 ? finalPay : finalPay.toFixed(1)}` : '—'}</span>
          </div>
        </div>
      </div>

      {/* 簽名欄（列印用） */}
      <div className="hidden print:flex justify-between mt-4 pt-2 border-t border-gray-400 text-xs text-gray-500">
        <span>製表人：＿＿＿</span>
        <span>簽名：＿＿＿</span>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CombinedPrintPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])

  const now = new Date()
  const [start, setStart] = useState(toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [end, setEnd] = useState(toInputDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)))

  const [empId1, setEmpId1] = useState<number | null>(null)
  const [empId2, setEmpId2] = useState<number | null>(null)
  const [shifts1, setShifts1] = useState<Shift[]>([])
  const [shifts2, setShifts2] = useState<Shift[]>([])
  const [totalHours1, setTotalHours1] = useState(0)
  const [totalHours2, setTotalHours2] = useState(0)
  const [loading1, setLoading1] = useState(false)
  const [loading2, setLoading2] = useState(false)
  const [rate1, setRate1] = useState('')
  const [rate2, setRate2] = useState('')
  const [adj1, setAdj1] = useState<Record<number, string>>({})
  const [adj2, setAdj2] = useState<Record<number, string>>({})

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(setEmployees)
  }, [])

  const fetchShifts = useCallback(async (empId: number | null, which: 1 | 2) => {
    if (!empId || !start || !end) return
    const setLoading = which === 1 ? setLoading1 : setLoading2
    const setShifts = which === 1 ? setShifts1 : setShifts2
    const setTotal = which === 1 ? setTotalHours1 : setTotalHours2
    const setAdj = which === 1 ? setAdj1 : setAdj2
    setLoading(true)
    setAdj({})
    const data = await fetch(`/api/employees/${empId}/hours?start=${start}&end=${end}`).then(r => r.json())
    setShifts(data.shifts ?? [])
    setTotal(data.totalHours ?? 0)
    setLoading(false)
  }, [start, end])

  useEffect(() => { fetchShifts(empId1, 1) }, [empId1, fetchShifts])
  useEffect(() => { fetchShifts(empId2, 2) }, [empId2, fetchShifts])

  const setPreset = (months: number) => {
    const s = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    setStart(toInputDate(s))
    setEnd(toInputDate(e))
  }

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 1cm; }
          body { background: white !important; }
          .slips-wrapper {
            display: flex !important;
            flex-direction: row !important;
            gap: 0.6cm !important;
            width: 100% !important;
          }
          .slip {
            flex: 1 !important;
            width: 0 !important;
            min-width: 0 !important;
            padding: 0.35cm !important;
            font-size: 8.5pt !important;
            page-break-inside: avoid;
          }
          .slip table { font-size: 8pt !important; }
          .slip input {
            border: 1px solid #888 !important;
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .total-bar {
            margin-top: 0.4cm !important;
            padding: 0.3cm 0.4cm !important;
            font-size: 9pt !important;
            border: 2px solid black !important;
          }
        }
      `}</style>

      <div className="max-w-5xl">
        {/* 螢幕導覽 */}
        <div className="flex items-center gap-3 mb-5 print:hidden">
          <button onClick={() => router.back()} className="text-amber-700 hover:underline text-sm">← 返回</button>
          <h1 className="text-2xl font-bold text-amber-950">合併薪資單</h1>
          <button
            onClick={() => window.print()}
            className="ml-auto px-3 py-1.5 text-sm rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50"
          >
            🖨️ 列印（A4）
          </button>
        </div>

        {/* 日期篩選 */}
        <div className="bg-white border border-amber-200 rounded-xl shadow-sm p-4 mb-5 print:hidden">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-sm font-semibold text-amber-900">篩選時段</span>
            <button onClick={() => setPreset(1)} className="px-2 py-1 text-xs rounded border border-amber-200 text-amber-800 hover:bg-amber-50">本月</button>
            <button onClick={() => setPreset(3)} className="px-2 py-1 text-xs rounded border border-amber-200 text-amber-800 hover:bg-amber-50">近三個月</button>
            <button onClick={() => setPreset(6)} className="px-2 py-1 text-xs rounded border border-amber-200 text-amber-800 hover:bg-amber-50">近半年</button>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={start} onChange={e => setStart(e.target.value)}
              className="border border-amber-200 rounded-lg px-2 py-1.5 text-sm text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            <span className="text-amber-400">至</span>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)}
              className="border border-amber-200 rounded-lg px-2 py-1.5 text-sm text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
        </div>

        {/* 兩張薪資單 */}
        <div className="slips-wrapper flex flex-col sm:flex-row gap-4">
          <Slip
            label="員工一"
            employees={employees}
            empId={empId1} setEmpId={setEmpId1}
            shifts={shifts1} totalHours={totalHours1} loading={loading1}
            hourlyRate={rate1} setHourlyRate={setRate1}
            adjustments={adj1} setAdjustments={setAdj1}
            start={start} end={end}
          />
          <Slip
            label="員工二"
            employees={employees}
            empId={empId2} setEmpId={setEmpId2}
            shifts={shifts2} totalHours={totalHours2} loading={loading2}
            hourlyRate={rate2} setHourlyRate={setRate2}
            adjustments={adj2} setAdjustments={setAdj2}
            start={start} end={end}
          />
        </div>

        {/* 合計列 */}
        {(() => {
          const r1 = parseFloat(rate1) || 0
          const r2 = parseFloat(rate2) || 0
          const a1 = Object.values(adj1).reduce((s, v) => s + (parseFloat(v) || 0), 0)
          const a2 = Object.values(adj2).reduce((s, v) => s + (parseFloat(v) || 0), 0)
          const pay1 = totalHours1 * r1 + a1
          const pay2 = totalHours2 * r2 + a2
          const total = pay1 + pay2
          const hasAny = r1 > 0 || r2 > 0
          if (!hasAny) return null
          return (
            <div className="total-bar mt-4 bg-white border-2 border-black rounded-xl print:rounded-none p-4 print:p-3 shadow-sm print:shadow-none">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-1 text-sm">
                <span className="font-bold text-base">本期薪資合計</span>
                {r1 > 0 && (
                  <span className="text-gray-600">
                    {employees.find(e => e.id === empId1)?.name ?? '員工一'}：
                    <span className="font-semibold ml-1">${pay1 % 1 === 0 ? pay1 : pay1.toFixed(1)}</span>
                  </span>
                )}
                {r2 > 0 && (
                  <span className="text-gray-600">
                    {employees.find(e => e.id === empId2)?.name ?? '員工二'}：
                    <span className="font-semibold ml-1">${pay2 % 1 === 0 ? pay2 : pay2.toFixed(1)}</span>
                  </span>
                )}
                <span className="font-bold text-lg ml-auto border-l-2 border-black pl-6">
                  總計 ${total % 1 === 0 ? total : total.toFixed(1)}
                </span>
              </div>
            </div>
          )
        })()}
      </div>
    </>
  )
}
