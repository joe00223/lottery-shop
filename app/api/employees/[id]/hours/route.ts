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

  // Find weekStarts overlapping the range
  const rangeStart = new Date(start)
  const dow = rangeStart.getDay()
  rangeStart.setDate(rangeStart.getDate() - (dow === 0 ? 6 : dow - 1))

  const schedules = await prisma.schedule.findMany({
    where: {
      employeeId: parseInt(id),
      weekStart: { gte: rangeStart, lte: end },
    },
    orderBy: [{ weekStart: 'asc' }, { dayOfWeek: 'asc' }, { hour: 'asc' }],
  })

  // Compute actual date for each entry and filter to range
  const entries = schedules
    .map((s) => {
      const offset = s.dayOfWeek === 0 ? 6 : s.dayOfWeek - 1
      const date = new Date(s.weekStart)
      date.setDate(date.getDate() + offset)
      date.setHours(0, 0, 0, 0)
      return { date, hour: s.hour, dateKey: date.toISOString().slice(0, 10) }
    })
    .filter((e) => e.date >= start && e.date <= end)

  // Group by date, then merge consecutive hours into shift blocks
  const byDate: { [key: string]: { date: Date; hours: number[] } } = {}
  for (const e of entries) {
    if (!byDate[e.dateKey]) byDate[e.dateKey] = { date: e.date, hours: [] }
    byDate[e.dateKey].hours.push(e.hour)
  }

  const shifts: Array<{
    date: string
    dayName: string
    startTime: string
    endTime: string
    hours: number
  }> = []

  for (const { date, hours } of Object.values(byDate)) {
    hours.sort((a, b) => a - b)
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
