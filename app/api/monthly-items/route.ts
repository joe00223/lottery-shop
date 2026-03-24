import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? '')
  const month = parseInt(searchParams.get('month') ?? '')
  if (!year || !month) return NextResponse.json({ error: 'year and month required' }, { status: 400 })
  const items = await prisma.monthlyItem.findMany({
    where: { year, month },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(items)
}

export async function POST(req: Request) {
  const body = await req.json()
  const item = await prisma.monthlyItem.create({
    data: {
      year: body.year,
      month: body.month,
      name: body.name ?? '',
      income: body.income ?? 0,
      expense: body.expense ?? 0,
      note: body.note ?? '',
      order: body.order ?? 0,
    },
  })
  return NextResponse.json(item)
}
