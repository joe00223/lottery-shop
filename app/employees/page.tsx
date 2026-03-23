'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Employee = {
  id: number
  name: string
  color: string
  active: boolean
}

const PRESET_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
]

export default function EmployeesPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', color: PRESET_COLORS[0] })

  const fetchEmployees = async () => {
    const res = await fetch('/api/employees')
    setEmployees(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchEmployees() }, [])

  const openAdd = () => {
    setEditId(null)
    setForm({ name: '', color: PRESET_COLORS[0] })
    setShowForm(true)
  }

  const openEdit = (emp: Employee) => {
    setEditId(emp.id)
    setForm({ name: emp.name, color: emp.color })
    setShowForm(true)
  }

  const save = async () => {
    if (!form.name.trim()) return
    if (editId) {
      await fetch(`/api/employees/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    } else {
      await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    }
    setShowForm(false)
    fetchEmployees()
  }

  const remove = async (id: number) => {
    if (!confirm('確定要刪除這位員工嗎？')) return
    await fetch(`/api/employees/${id}`, { method: 'DELETE' })
    fetchEmployees()
  }

  if (loading) return <div className="text-amber-700 mt-8 text-center">載入中...</div>

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-amber-950">員工管理</h1>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
        >
          新增員工
        </button>
      </div>

      {/* Employee list */}
      <div className="space-y-2">
        {employees.map((emp) => (
          <div
            key={emp.id}
            className="flex items-center gap-3 bg-white border border-amber-200 rounded-lg px-4 py-3 shadow-sm cursor-pointer hover:bg-amber-50 transition-colors"
            onClick={() => router.push(`/employees/${emp.id}`)}
          >
            <span className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: emp.color }} />
            <span className="font-medium text-amber-950 flex-1">{emp.name}</span>
            <span className="text-xs text-amber-700 font-medium mr-2">查看時數 →</span>
            <button
              onClick={(e) => { e.stopPropagation(); openEdit(emp) }}
              className="text-sm text-amber-700 hover:underline font-medium"
            >
              編輯
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); remove(emp.id) }}
              className="text-sm text-red-500 hover:underline"
            >
              刪除
            </button>
          </div>
        ))}
        {employees.length === 0 && (
          <div className="text-center text-gray-500 py-12">還沒有員工，先新增員工吧</div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 border-t-4 border-amber-400">
            <h2 className="text-lg font-bold text-amber-950 mb-4">{editId ? '編輯員工' : '新增員工'}</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-amber-900 mb-1">姓名</label>
              <input
                className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="輸入員工姓名"
                autoFocus
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-amber-900 mb-2">顏色</label>
              <div className="flex gap-2 flex-wrap mb-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`w-8 h-8 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-2 ring-amber-400' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="w-8 h-8 rounded cursor-pointer border border-amber-200"
                />
                <span className="text-xs text-gray-500 font-mono">{form.color}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 border border-amber-200 rounded-lg text-sm font-medium text-amber-900 hover:bg-amber-50"
              >
                取消
              </button>
              <button
                onClick={save}
                className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
              >
                儲存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
