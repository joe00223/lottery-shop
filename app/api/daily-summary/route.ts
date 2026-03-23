import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })
  const record = await prisma.dailySummary.findUnique({ where: { date: new Date(date) } })
  return NextResponse.json(record ?? {
    lotterySales: 0, lotteryRedemption: 0,
    scratchRedemption: 0,
    sportsSales: 0, sportsRedemption: 0,
  })
}

export async function POST(req: Request) {
  const body = await req.json()
  const { date, ...data } = body
  const record = await prisma.dailySummary.upsert({
    where: { date: new Date(date) },
    update: data,
    create: { date: new Date(date), ...data },
  })
  return NextResponse.json(record)
}
