import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || '')
  const month = parseInt(searchParams.get('month') || '') // 1-12

  if (!year || !month) return NextResponse.json({})

  // Find weekStarts that could overlap with this month
  // Buffer: from last Monday of prev month to first Monday after month end
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)

  // Monday on or before firstDay
  const rangeStart = new Date(firstDay)
  const startDow = rangeStart.getDay()
  rangeStart.setDate(rangeStart.getDate() - (startDow === 0 ? 6 : startDow - 1))

  // Monday on or after lastDay
  const rangeEnd = new Date(lastDay)
  const endDow = rangeEnd.getDay()
  rangeEnd.setDate(rangeEnd.getDate() + (endDow === 0 ? 0 : 7 - endDow + 1))

  const schedules = await prisma.schedule.findMany({
    where: {
      weekStart: { gte: rangeStart, lte: rangeEnd },
      employeeId: { not: null },
    },
    include: { employee: true },
  })

  // Count hours per employee, filtering to actual month
  const hoursMap: { [employeeId: number]: { name: string; color: string; hours: number } } = {}

  for (const s of schedules) {
    if (!s.employeeId || !s.employee) continue

    // Compute actual date of this slot
    const offset = s.dayOfWeek === 0 ? 6 : s.dayOfWeek - 1
    const actualDate = new Date(s.weekStart)
    actualDate.setDate(actualDate.getDate() + offset)

    if (actualDate.getFullYear() !== year || actualDate.getMonth() + 1 !== month) continue

    if (!hoursMap[s.employeeId]) {
      hoursMap[s.employeeId] = { name: s.employee.name, color: s.employee.color, hours: 0 }
    }
    hoursMap[s.employeeId].hours += 1
  }

  return NextResponse.json(hoursMap)
}
