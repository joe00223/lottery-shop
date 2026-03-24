import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const items = await prisma.monthlyItemTemplate.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] })
  return NextResponse.json(items)
}

export async function POST(req: Request) {
  const body = await req.json()
  const last = await prisma.monthlyItemTemplate.findFirst({ orderBy: { order: 'desc' } })
  const item = await prisma.monthlyItemTemplate.create({
    data: {
      name: body.name ?? '',
      income: body.income ?? 0,
      expense: body.expense ?? 0,
      note: body.note ?? '',
      order: (last?.order ?? 0) + 1,
    },
  })
  return NextResponse.json(item)
}
