'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { DAYS, getWeekStart, formatWeekRange, parseHour, StoreHours } from '@/lib/utils'

type Employee = { id: number; name: string; color: string }
type ScheduleCell = { employeeId: number | null; employee: Employee | null }
type GridData = { [day: number]: { [hour: number]: { [row: number]: ScheduleCell } } }

type DragState = {
  dayIdx: number
  rowIndex: number
  startHour: number
  endHour: number
}

type PickerState = DragState & { top: number; left: number }

type Props = { storeHours: StoreHours; employees: Employee[]; editing: boolean }

export default function ScheduleGrid({ storeHours, employees, editing }: Props) {
  const [currentWeek, setCurrentWeek] = useState<Date>(getWeekStart(new Date()))
  const [grid, setGrid] = useState<GridData>({})
  const [loading, setLoading] = useState(true)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [dragging, setDragging] = useState(false)
  const [picker, setPicker] = useState<PickerState | null>(null)
  const [rowsPerDay, setRowsPerDay] = useState<{ [dayIdx: number]: number }>({})
  const [copied, setCopied] = useState<{
    schedules: Array<{ dayOfWeek: number; hour: number; rowIndex: number; employeeId: number | null }>
    rowsPerDay: { [dayIdx: number]: number }
  } | null>(null)
  const [pasting, setPasting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const gridRef = useRef<HTMLTableElement>(null)

  const allHours = Object.values(storeHours).flatMap((h) => [parseHour(h.open), parseHour(h.close)])
  const minHour = Math.min(...allHours, 8)
  const maxHour = Math.max(...allHours, 22)
  const hours = Array.from({ length: maxHour - minHour }, (_, i) => minHour + i)
  const dayOfWeekMap = [1, 2, 3, 4, 5, 6, 0]

  const fetchSchedule = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/schedule?weekStart=${currentWeek.toISOString()}`)
    const data = await res.json()
    const g: GridData = {}
    const rowsMap: { [dayIdx: number]: number } = {}
    for (const s of data) {
      if (!g[s.dayOfWeek]) g[s.dayOfWeek] = {}
      if (!g[s.dayOfWeek][s.hour]) g[s.dayOfWeek][s.hour] = {}
      g[s.dayOfWeek][s.hour][s.rowIndex] = { employeeId: s.employeeId, employee: s.employee }
      const dayIdx = dayOfWeekMap.indexOf(s.dayOfWeek)
      if (dayIdx >= 0) {
        rowsMap[dayIdx] = Math.max(rowsMap[dayIdx] ?? 1, s.rowIndex + 1)
      }
    }
    setGrid(g)
    setRowsPerDay(rowsMap)
    setLoading(false)
  }, [currentWeek])

  useEffect(() => { fetchSchedule() }, [fetchSchedule])

  // Cancel drag if mouse released outside table
  useEffect(() => {
    const onMouseUp = () => {
      if (dragging) {
        setDragging(false)
        setDrag(null)
      }
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [dragging])

  const getCellData = (day: number, hour: number, row: number): ScheduleCell =>
    grid[day]?.[hour]?.[row] ?? { employeeId: null, employee: null }

  const getRowCount = (dayIdx: number) => rowsPerDay[dayIdx] ?? 1

  const isInDrag = (dayIdx: number, rowIndex: number, hour: number): boolean => {
    if (!dragging || !drag) return false
    if (drag.dayIdx !== dayIdx || drag.rowIndex !== rowIndex) return false
    const lo = Math.min(drag.startHour, drag.endHour)
    const hi = Math.max(drag.startHour, drag.endHour)
    return hour >= lo && hour <= hi
  }

  const assignRange = async (dayIdx: number, rowIndex: number, startHour: number, endHour: number, employeeId: number | null) => {
    const dow = dayOfWeekMap[dayIdx]
    const emp = employees.find((e) => e.id === employeeId) ?? null
    const lo = Math.min(startHour, endHour)
    const hi = Math.max(startHour, endHour)

    setGrid((g) => {
      const next = { ...g }
      if (!next[dow]) next[dow] = {}
      for (let h = lo; h <= hi; h++) {
        if (!next[dow][h]) next[dow][h] = {}
        next[dow][h][rowIndex] = { employeeId, employee: emp }
      }
      return next
    })

    await Promise.all(
      Array.from({ length: hi - lo + 1 }, (_, i) =>
        fetch('/api/schedule', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            weekStart: currentWeek.toISOString(),
            dayOfWeek: dow,
            hour: lo + i,
            rowIndex,
            employeeId,
          }),
        })
      )
    )
  }

  const exportImage = async () => {
    if (!gridRef.current) return
    setExporting(true)
    const { toPng } = await import('html-to-image')
    const dataUrl = await toPng(gridRef.current, {
      backgroundColor: '#fffbeb',
      pixelRatio: 2,
    })
    const link = document.createElement('a')
    link.download = `班表_${formatWeekRange(currentWeek)}.png`
    link.href = dataUrl
    link.click()
    setExporting(false)
  }

  const copyWeek = () => {
    const schedules: Array<{ dayOfWeek: number; hour: number; rowIndex: number; employeeId: number | null }> = []
    for (const [dow, hourMap] of Object.entries(grid)) {
      for (const [hour, rowMap] of Object.entries(hourMap)) {
        for (const [rowIndex, cell] of Object.entries(rowMap)) {
          schedules.push({
            dayOfWeek: parseInt(dow),
            hour: parseInt(hour),
            rowIndex: parseInt(rowIndex),
            employeeId: cell.employeeId,
          })
        }
      }
    }
    setCopied({ schedules, rowsPerDay })
  }

  const pasteWeek = async () => {
    if (!copied) return
    setPasting(true)
    await Promise.all(
      copied.schedules.map((s) =>
        fetch('/api/schedule', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            weekStart: currentWeek.toISOString(),
            dayOfWeek: s.dayOfWeek,
            hour: s.hour,
            rowIndex: s.rowIndex,
            employeeId: s.employeeId,
          }),
        })
      )
    )
    setRowsPerDay(copied.rowsPerDay)
    await fetchSchedule()
    setPasting(false)
  }

  const isOperating = (dayIdx: number, hour: number): boolean => {
    const key = String(dayOfWeekMap[dayIdx])
    const h = storeHours[key]
    if (!h) return false
    return hour >= parseHour(h.open) && hour < parseHour(h.close)
  }

  const getDayDate = (dayIdx: number): string => {
    const d = new Date(currentWeek)
    d.setDate(d.getDate() + dayIdx)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  const prevWeek = () => { const d = new Date(currentWeek); d.setDate(d.getDate() - 7); setCurrentWeek(d) }
  const nextWeek = () => { const d = new Date(currentWeek); d.setDate(d.getDate() + 7); setCurrentWeek(d) }
  const goToday = () => setCurrentWeek(getWeekStart(new Date()))

  return (
    <div>
      {/* Week Navigation */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={prevWeek} className="px-3 py-1.5 rounded bg-white border border-amber-300 text-sm font-medium text-amber-900 hover:bg-amber-50">
          ← 上週
        </button>
        <button onClick={goToday} className="px-3 py-1.5 rounded bg-amber-100 border border-amber-300 text-sm font-medium text-amber-900 hover:bg-amber-200">
          本週
        </button>
        <button onClick={nextWeek} className="px-3 py-1.5 rounded bg-white border border-amber-300 text-sm font-medium text-amber-900 hover:bg-amber-50">
          下週 →
        </button>
        <span className="text-amber-950 font-semibold ml-2">{formatWeekRange(currentWeek)}</span>
        <input
          type="date"
          onChange={(e) => {
            if (!e.target.value) return
            setCurrentWeek(getWeekStart(new Date(e.target.value + 'T12:00:00')))
          }}
          className="ml-2 border border-amber-300 rounded-lg px-2 py-1 text-sm text-amber-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          title="跳至指定週"
        />
        {loading && <span className="text-amber-400 text-sm ml-2">載入中...</span>}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={copyWeek}
            className="px-3 py-1.5 rounded bg-white border border-amber-300 text-sm font-medium text-amber-900 hover:bg-amber-50"
          >
            複製本週
          </button>
          {copied && (
            <button
              onClick={pasteWeek}
              disabled={pasting}
              className="px-3 py-1.5 rounded bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50"
            >
              {pasting ? '貼上中...' : '貼上班表'}
            </button>
          )}
          <button
            onClick={exportImage}
            disabled={exporting}
            className="px-3 py-1.5 rounded bg-amber-800 text-white text-sm font-semibold hover:bg-amber-900 disabled:opacity-50"
          >
            {exporting ? '匯出中...' : '匯出圖片'}
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border border-amber-200 bg-white shadow-sm select-none">
        <table ref={gridRef} className="border-collapse" style={{ tableLayout: 'fixed', width: 'max-content' }}>
          <thead>
            <tr>
              <th className="sticky left-0 bg-amber-50 z-10 w-20 min-w-20 border-b border-r border-amber-200 text-xs text-amber-700 font-semibold p-2">
                日期
              </th>
              {hours.map((h) => (
                <th key={h} className="w-16 min-w-16 border-b border-r border-amber-200 bg-amber-50 text-xs text-amber-700 font-semibold p-2 text-center">
                  {String(h).padStart(2, '0')}:00
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((dayName, dayIdx) => {
              const dow = dayOfWeekMap[dayIdx]
              const rowCount = getRowCount(dayIdx)
              const dayDate = getDayDate(dayIdx)

              return (
                <React.Fragment key={dayIdx}>
                  {Array.from({ length: rowCount }, (_, rowIndex) => (
                    <tr key={`${dayIdx}-${rowIndex}`}>
                      {rowIndex === 0 && (
                        <td
                          rowSpan={rowCount}
                          className="sticky left-0 bg-amber-50 z-10 border-b-2 border-r border-amber-200 p-1 text-center align-middle"
                          style={{ width: '80px', minWidth: '80px' }}
                        >
                          <div className="text-xs font-bold text-amber-900 leading-tight">{dayName}</div>
                          <div className="text-xs text-amber-600 leading-tight">{dayDate}</div>
                          {editing && (
                            <div className="flex items-center justify-center gap-1 mt-1.5">
                              <button
                                onClick={() => setRowsPerDay((r) => ({ ...r, [dayIdx]: (r[dayIdx] ?? 1) + 1 }))}
                                className="w-5 h-5 rounded-full bg-amber-300 text-amber-900 text-xs font-bold hover:bg-amber-400 flex items-center justify-center leading-none"
                              >
                                +
                              </button>
                              {rowCount > 1 && (
                                <button
                                  onClick={() => setRowsPerDay((r) => ({ ...r, [dayIdx]: Math.max(1, (r[dayIdx] ?? 1) - 1) }))}
                                  className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 text-xs font-bold hover:bg-red-200 hover:text-red-700 flex items-center justify-center leading-none"
                                >
                                  −
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                      {hours.map((h, hIdx) => {
                        const operating = isOperating(dayIdx, h)
                        const cell = getCellData(dow, h, rowIndex)
                        const inDrag = isInDrag(dayIdx, rowIndex, h)

                        const prevH = hours[hIdx - 1]
                        const nextH = hours[hIdx + 1]
                        const prevCell = prevH !== undefined ? getCellData(dow, prevH, rowIndex) : null
                        const nextCell = nextH !== undefined ? getCellData(dow, nextH, rowIndex) : null
                        const prevSame = !!cell.employee && prevCell?.employeeId === cell.employeeId && prevH !== undefined && isOperating(dayIdx, prevH)
                        const nextSame = !!cell.employee && nextCell?.employeeId === cell.employeeId && nextH !== undefined && isOperating(dayIdx, nextH)

                        // Compute run span for centering the name
                        let runSpan = 1
                        if (!prevSame && cell.employee) {
                          while (
                            hIdx + runSpan < hours.length &&
                            isOperating(dayIdx, hours[hIdx + runSpan]) &&
                            getCellData(dow, hours[hIdx + runSpan], rowIndex).employeeId === cell.employeeId
                          ) runSpan++
                        }

                        const CELL_W = 64

                        return (
                          <td
                            key={h}
                            className={`border-b border-r border-amber-100 p-0 relative ${
                              !operating
                                ? 'bg-amber-50'
                                : inDrag
                                ? 'bg-amber-200'
                                : 'bg-white'
                            } ${editing && operating ? 'cursor-crosshair' : ''}`}
                            style={{
                              height: '38px',
                              width: `${CELL_W}px`,
                              ...(nextSame && cell.employee && !inDrag ? { borderRightColor: cell.employee.color } : {}),
                            }}
                            onMouseDown={(e) => {
                              if (!editing || !operating) return
                              e.preventDefault()
                              setPicker(null)
                              setDragging(true)
                              setDrag({ dayIdx, rowIndex, startHour: h, endHour: h })
                            }}
                            onMouseEnter={() => {
                              if (!dragging || !drag) return
                              if (drag.dayIdx !== dayIdx || drag.rowIndex !== rowIndex) return
                              setDrag((d) => d ? { ...d, endHour: h } : d)
                            }}
                            onMouseUp={(e) => {
                              if (!drag || drag.dayIdx !== dayIdx || drag.rowIndex !== rowIndex) return
                              const finalDrag = { ...drag, endHour: h }
                              setDragging(false)
                              setDrag(null)
                              setPicker({
                                ...finalDrag,
                                startHour: Math.min(finalDrag.startHour, finalDrag.endHour),
                                endHour: Math.max(finalDrag.startHour, finalDrag.endHour),
                                top: e.clientY + 8,
                                left: Math.min(e.clientX, window.innerWidth - 160),
                              })
                            }}
                          >
                            {operating && !inDrag && cell.employee && (
                              <>
                                {/* Background block */}
                                <div
                                  className="absolute inset-0 pointer-events-none"
                                  style={{
                                    backgroundColor: cell.employee.color,
                                    borderRadius: `${!prevSame ? 5 : 0}px ${!nextSame ? 5 : 0}px ${!nextSame ? 5 : 0}px ${!prevSame ? 5 : 0}px`,
                                  }}
                                />
                                {/* Centered name spanning full run width */}
                                {!prevSame && (
                                  <div
                                    className="absolute top-0 left-0 h-full flex items-center justify-center pointer-events-none z-10"
                                    style={{ width: `${runSpan * CELL_W}px` }}
                                  >
                                    <span className="text-black text-sm font-bold truncate px-2" style={{ textShadow: '0 0 4px #fff, 0 0 4px #fff, 0 1px 2px #fff' }}>
                                      {cell.employee.name}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Employee picker popup */}
      {picker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPicker(null)} />
          <div
            className="fixed z-50 bg-white border border-amber-200 rounded-lg shadow-xl p-2 min-w-36"
            style={{ top: picker.top, left: picker.left }}
          >
            <div className="text-xs text-amber-600 font-semibold mb-1.5 px-1">
              {String(picker.startHour).padStart(2, '0')}:00 – {String(picker.endHour + 1).padStart(2, '0')}:00
            </div>
            {employees.map((emp) => (
              <button
                key={emp.id}
                onClick={() => {
                  assignRange(picker.dayIdx, picker.rowIndex, picker.startHour, picker.endHour, emp.id)
                  setPicker(null)
                }}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-amber-50 text-sm text-left text-amber-950"
              >
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: emp.color }} />
                {emp.name}
              </button>
            ))}
            <button
              onClick={() => {
                assignRange(picker.dayIdx, picker.rowIndex, picker.startHour, picker.endHour, null)
                setPicker(null)
              }}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-red-50 text-sm text-red-500 mt-1 border-t border-amber-100 pt-2"
            >
              清除
            </button>
          </div>
        </>
      )}
    </div>
  )
}
