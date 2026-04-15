'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

type Employee = { id: number; name: string; color: string }
type Shift = { date: string; dayName: string; startTime: string; endTime: string; hours: number }

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function formatPrintDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${parseInt(m)}月${parseInt(d)}日`
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [totalHours, setTotalHours] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hourlyRate, setHourlyRate] = useState('')
  const [adjustments, setAdjustments] = useState<Record<number, string>>({})

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const [start, setStart] = useState(toInputDate(firstOfMonth))
  const [end, setEnd] = useState(toInputDate(lastOfMonth))

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then((emps: Employee[]) => {
      const emp = emps.find(e => e.id === parseInt(id))
      if (emp) setEmployee(emp)
    })
  }, [id])

  useEffect(() => {
    if (!start || !end) return
    setLoading(true)
    setAdjustments({})
    fetch(`/api/employees/${id}/hours?start=${start}&end=${end}`)
      .then(r => r.json())
      .then(data => {
        setShifts(data.shifts ?? [])
        setTotalHours(data.totalHours ?? 0)
        setLoading(false)
      })
  }, [id, start, end])

  const setPreset = (months: number) => {
    const s = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    setStart(toInputDate(s))
    setEnd(toInputDate(e))
  }

  const rate = parseFloat(hourlyRate) || 0
  const rowPay = (i: number, hours: number) => {
    const adj = parseFloat(adjustments[i] ?? '') || 0
    return hours * rate + adj
  }
  const totalAdj = Object.entries(adjustments).reduce((sum, [, v]) => sum + (parseFloat(v) || 0), 0)
  const basePay = totalHours * rate
  const finalPay = basePay + totalAdj

  if (!employee) return <div className="text-amber-700 mt-8 text-center">載入中...</div>

  return (
    <div className="max-w-2xl">

      {/* ── 螢幕用導覽列 ── */}
      <div className="flex items-center gap-3 mb-6 print:hidden">
        <button onClick={() => router.back()} className="text-amber-700 hover:underline text-sm">← 返回</button>
        <span className="w-5 h-5 rounded-full" style={{ backgroundColor: employee.color }} />
        <h1 className="text-2xl font-bold text-amber-950">{employee.name}</h1>
        <button
          onClick={() => window.print()}
          className="ml-auto px-3 py-1.5 text-sm rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50"
        >
          🖨️ 列印薪資單
        </button>
      </div>

      {/* ── 螢幕用篩選器 ── */}
      <div className="bg-white border border-amber-200 rounded-xl shadow-sm p-4 mb-4 print:hidden">
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

      {/* ════════════════════════════════════════
          薪資單主體（螢幕 + 列印都顯示）
          ════════════════════════════════════════ */}
      <div className="bg-white border-2 border-black print:border-black rounded-xl print:rounded-none p-6 print:p-4 shadow-sm print:shadow-none">

        {/* 標題 */}
        <div className="text-center mb-4 border-b-2 border-black pb-3">
          <div className="text-xl font-bold tracking-wide">{employee.name}　薪資單</div>
          <div className="text-sm mt-1">
            {formatPrintDate(start)}　至　{formatPrintDate(end)}
          </div>
        </div>

        {/* 班次明細表 */}
        {loading ? (
          <div className="text-center text-sm py-8 text-gray-400">載入中...</div>
        ) : shifts.length === 0 ? (
          <div className="text-center text-sm py-8 text-gray-300">此時段內無排班紀錄</div>
        ) : (
          <table className="w-full text-sm border-collapse mb-4">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="text-left py-1.5 pr-3 font-bold">日期</th>
                <th className="text-center py-1.5 px-2 font-bold w-10">星期</th>
                <th className="text-left py-1.5 px-3 font-bold">時段</th>
                <th className="text-center py-1.5 px-2 font-bold w-14">時數</th>
                <th className="text-center py-1.5 px-2 font-bold w-24">調整（元）</th>
                <th className="text-right py-1.5 pl-3 font-bold w-20">小計</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s, i) => {
                const adj = parseFloat(adjustments[i] ?? '') || 0
                const pay = rowPay(i, s.hours)
                return (
                  <tr key={i} className="border-b border-gray-300">
                    <td className="py-1.5 pr-3 font-medium">{s.date}</td>
                    <td className="py-1.5 px-2 text-center text-gray-600">{s.dayName}</td>
                    <td className="py-1.5 px-3 text-gray-700">{s.startTime}–{s.endTime}</td>
                    <td className="py-1.5 px-2 text-center font-semibold">{s.hours}h</td>
                    <td className="py-1 px-2 text-center">
                      <input
                        type="number"
                        value={adjustments[i] ?? ''}
                        onChange={e => setAdjustments(prev => ({ ...prev, [i]: e.target.value }))}
                        placeholder="0"
                        className="w-full text-center border border-gray-400 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-black print:border-gray-400"
                      />
                    </td>
                    <td className="py-1.5 pl-3 text-right font-medium">
                      {rate > 0
                        ? `$${pay % 1 === 0 ? pay : pay.toFixed(1)}`
                        : adj !== 0 ? `$${adj}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* 薪資計算區 */}
        <div className="border-t-2 border-black pt-4 mt-2">
          <div className="flex items-start gap-6">

            {/* 左：時薪輸入 */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold">時薪</span>
                <span className="text-sm">$</span>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={e => setHourlyRate(e.target.value)}
                  placeholder="請輸入時薪"
                  className="border-b-2 border-black w-28 text-center py-0.5 text-sm font-semibold focus:outline-none bg-transparent print:border-black"
                />
                <span className="text-sm text-gray-500">/ 小時</span>
              </div>
              <div className="text-xs text-gray-500 print:hidden">
                填入時薪後自動計算每日薪資
              </div>
            </div>

            {/* 右：薪資加總 */}
            <div className="text-right space-y-1.5 min-w-[160px]">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-gray-600">總時數</span>
                <span className="font-semibold">{totalHours} 小時</span>
              </div>
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-gray-600">底薪（時數 × 時薪）</span>
                <span className="font-semibold">{rate > 0 ? `$${basePay % 1 === 0 ? basePay : basePay.toFixed(1)}` : '—'}</span>
              </div>
              {totalAdj !== 0 && (
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-gray-600">調整合計</span>
                  <span className="font-semibold">{totalAdj > 0 ? `+$${totalAdj}` : `-$${Math.abs(totalAdj)}`}</span>
                </div>
              )}
              <div className="flex justify-between gap-4 text-base font-bold border-t-2 border-black pt-1.5 mt-1">
                <span>實領薪資</span>
                <span>{rate > 0 ? `$${finalPay % 1 === 0 ? finalPay : finalPay.toFixed(1)}` : '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 簽名欄（僅列印） */}
        <div className="hidden print:flex justify-between mt-8 pt-4 border-t border-gray-400 text-sm text-gray-600">
          <div>製表人：＿＿＿＿＿</div>
          <div>員工簽名：＿＿＿＿＿</div>
        </div>
      </div>
    </div>
  )
}
