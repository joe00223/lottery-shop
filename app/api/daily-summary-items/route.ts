import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const [items, allNames] = await Promise.all([
    prisma.dailySummaryItem.findMany({
      where: { date: new Date(date) },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.dailySummaryItem.findMany({
      distinct: ['name'],
      select: { name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return NextResponse.json({ items, names: allNames.map(r => r.name) })
}

export async function POST(req: Request) {
  const { date, name, amount } = await req.json()
  const item = await prisma.dailySummaryItem.create({
    data: { date: new Date(date), name, amount },
  })
  return NextResponse.json(item)
}
