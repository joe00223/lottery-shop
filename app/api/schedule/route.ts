import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const weekStart = new Date(searchParams.get('weekStart') || '')
  const schedules = await prisma.schedule.findMany({
    where: { weekStart },
    include: { employee: true },
  })
  return NextResponse.json(schedules)
}

export async function PUT(req: Request) {
  const body = await req.json()
  // body: { weekStart, dayOfWeek, hour, rowIndex, employeeId }
  const weekStart = new Date(body.weekStart)
  const schedule = await prisma.schedule.upsert({
    where: {
      weekStart_dayOfWeek_hour_rowIndex: {
        weekStart,
        dayOfWeek: body.dayOfWeek,
        hour: body.hour,
        rowIndex: body.rowIndex ?? 0,
      },
    },
    update: { employeeId: body.employeeId ?? null },
    create: {
      weekStart,
      dayOfWeek: body.dayOfWeek,
      hour: body.hour,
      rowIndex: body.rowIndex ?? 0,
      employeeId: body.employeeId ?? null,
    },
    include: { employee: true },
  })
  return NextResponse.json(schedule)
}
