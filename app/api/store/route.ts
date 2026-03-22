import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  let store = await prisma.store.findFirst()
  if (!store) {
    store = await prisma.store.create({
      data: { id: 1, name: '我的彩券行' },
    })
  }
  return NextResponse.json(store)
}

export async function PUT(req: Request) {
  const body = await req.json()
  const store = await prisma.store.upsert({
    where: { id: 1 },
    update: { name: body.name, hours: body.hours },
    create: { id: 1, name: body.name, hours: body.hours },
  })
  return NextResponse.json(store)
}
