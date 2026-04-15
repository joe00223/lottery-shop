import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DAY_NAMES = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)

  const start = new Date(searchParams.get('start') + 'T00:00:00')
  const end = new Date(searchParams.get('end') + 'T23:59:59')

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ shifts: [], totalHours: 0 })
  }

  // Find all weeks that could overlap the range.
  // A week (Mon–Sun) overlaps [start, end] if weekStart <= end AND weekStart >= start - 6 days.
  const startMinus6 = new Date(start)
  startMinus6.setDate(startMinus6.getDate() - 6)

  const schedules = await prisma.schedule.findMany({
    where: {
      employeeId: parseInt(id),
      weekStart: { gte: startMinus6, lte: end },
    },
    orderBy: [{ weekStart: 'asc' }, { dayOfWeek: 'asc' }, { hour: 'asc' }],
  })

  // Compute actual LOCAL date for each entry and filter to range
  function localDateKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const entries = schedules
    .map((s) => {
      const offset = s.dayOfWeek === 0 ? 6 : s.dayOfWeek - 1
      // Reconstruct weekStart as local midnight to avoid UTC offset shifting the day
      const ws = new Date(s.weekStart)
      const date = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + offset)
      return { date, hour: s.hour, dateKey: localDateKey(date) }
    })
    .filter((e) => e.date >= start && e.date <= end)

  // Group by local date; deduplicate hours per day (handles multiple rowIndex)
  const byDate: { [key: string]: { date: Date; hours: Set<number> } } = {}
  for (const e of entries) {
    if (!byDate[e.dateKey]) byDate[e.dateKey] = { date: e.date, hours: new Set() }
    byDate[e.dateKey].hours.add(e.hour)
  }

  const shifts: Array<{
    date: string
    dayName: string
    startTime: string
    endTime: string
    hours: number
  }> = []

  // Sort by actual local date ascending
  const sortedByDate = Object.values(byDate).sort((a, b) => a.date.getTime() - b.date.getTime())

  for (const { date, hours: hoursSet } of sortedByDate) {
    const hours = [...hoursSet].sort((a, b) => a - b)
    // Merge consecutive hours into blocks
    let i = 0
    while (i < hours.length) {
      let j = i + 1
      while (j < hours.length && hours[j] === hours[j - 1] + 1) j++
      const blockHours = j - i
      shifts.push({
        date: date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }),
        dayName: DAY_NAMES[date.getDay()],
        startTime: `${String(hours[i]).padStart(2, '0')}:00`,
        endTime: `${String(hours[j - 1] + 1).padStart(2, '0')}:00`,
        hours: blockHours,
      })
      i = j
    }
  }

  const totalHours = shifts.reduce((sum, s) => sum + s.hours, 0)
  return NextResponse.json({ shifts, totalHours })
}
