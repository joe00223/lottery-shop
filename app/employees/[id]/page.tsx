'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

type Employee = { id: number; name: string; color: string }
type Shift = { date: string; dayName: string; startTime: string; endTime: string; hours: number }

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [totalHours, setTotalHours] = useState(0)
  const [loading, setLoading] = useState(false)

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

  if (!employee) return <div className="text-amber-700 mt-8 text-center">載入中...</div>

  return (
    <div className="max-w-xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-amber-700 hover:underline text-sm">← 返回</button>
        <span className="w-5 h-5 rounded-full" style={{ backgroundColor: employee.color }} />
        <h1 className="text-2xl font-bold text-amber-950">{employee.name}</h1>
      </div>

      {/* Date range filter */}
      <div className="bg-white border border-amber-200 rounded-xl shadow-sm p-4 mb-4">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-sm font-semibold text-amber-900">篩選時段</span>
          <button onClick={() => setPreset(1)} className="px-2 py-1 text-xs rounded border border-amber-200 text-amber-800 hover:bg-amber-50">本月</button>
          <button onClick={() => setPreset(3)} className="px-2 py-1 text-xs rounded border border-amber-200 text-amber-800 hover:bg-amber-50">近三個月</button>
          <button onClick={() => setPreset(6)} className="px-2 py-1 text-xs rounded border border-amber-200 text-amber-800 hover:bg-amber-50">近半年</button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={start}
            onChange={e => setStart(e.target.value)}
            className="border border-amber-200 rounded-lg px-2 py-1.5 text-sm text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <span className="text-amber-400">至</span>
          <input
            type="date"
            value={end}
            onChange={e => setEnd(e.target.value)}
            className="border border-amber-200 rounded-lg px-2 py-1.5 text-sm text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      {/* Summary */}
      <div
        className="rounded-xl p-4 mb-4 text-white shadow-sm"
        style={{ backgroundColor: employee.color }}
      >
        <div className="text-sm font-medium opacity-80">合計工作時數</div>
        <div className="text-4xl font-bold mt-1">{totalHours} <span className="text-2xl font-medium">小時</span></div>
        <div className="text-sm opacity-70 mt-1">{shifts.length} 筆班次</div>
      </div>

      {/* Shift log */}
      <div className="bg-white border border-amber-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center text-amber-400 text-sm py-8">載入中...</div>
        ) : shifts.length === 0 ? (
          <div className="text-center text-amber-300 text-sm py-8">此時段內無排班紀錄</div>
        ) : (
          <table className="border-collapse text-sm w-full">
            <thead>
              <tr className="bg-amber-100">
                <th className="border-b border-r border-amber-200 px-4 py-2 text-amber-900 font-bold text-left">日期</th>
                <th className="border-b border-r border-amber-200 px-3 py-2 text-amber-900 font-bold text-center w-10">星期</th>
                <th className="border-b border-r border-amber-200 px-4 py-2 text-amber-900 font-bold text-left">時段</th>
                <th className="border-b border-amber-200 px-4 py-2 text-amber-900 font-bold text-center">時數</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-amber-50/40'}>
                  <td className="border-b border-r border-amber-100 px-4 py-2.5 font-semibold text-amber-900">{s.date}</td>
                  <td className="border-b border-r border-amber-100 px-3 py-2.5 text-center text-amber-500 text-xs">{s.dayName}</td>
                  <td className="border-b border-r border-amber-100 px-4 py-2.5 text-amber-800">{s.startTime} – {s.endTime}</td>
                  <td className="border-b border-amber-100 px-4 py-2.5 text-center">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: employee.color }}>
                      {s.hours}h
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-amber-50 border-t-2 border-amber-300">
                <td colSpan={3} className="px-4 py-2 text-amber-800 font-semibold text-sm">{shifts.length} 筆班次</td>
                <td className="px-4 py-2 text-center">
                  <span className="px-3 py-1 rounded-full text-sm font-bold text-white" style={{ backgroundColor: employee.color }}>
                    {totalHours}h
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
