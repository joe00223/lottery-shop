import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const items = await prisma.extraItemTemplate.findMany({ orderBy: { order: 'asc' } })
  return NextResponse.json(items)
}

export async function POST(req: Request) {
  const { name, amount } = await req.json()
  const last = await prisma.extraItemTemplate.findFirst({ orderBy: { order: 'desc' } })
  const item = await prisma.extraItemTemplate.create({
    data: { name, amount: amount ?? 0, order: (last?.order ?? 0) + 1 },
  })
  return NextResponse.json(item)
}
