import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const item = await prisma.monthlyItemTemplate.update({
    where: { id: parseInt(id) },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.income !== undefined && { income: body.income }),
      ...(body.expense !== undefined && { expense: body.expense }),
      ...(body.note !== undefined && { note: body.note }),
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.monthlyItemTemplate.delete({ where: { id: parseInt(id) } })
  return NextResponse.json({ ok: true })
}
