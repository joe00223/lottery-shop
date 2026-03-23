import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { name, amount } = await req.json()
  const item = await prisma.dailySummaryItem.update({
    where: { id: parseInt(id) },
    data: { name, amount },
  })
  return NextResponse.json(item)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.dailySummaryItem.delete({ where: { id: parseInt(id) } })
  return NextResponse.json({ ok: true })
}
