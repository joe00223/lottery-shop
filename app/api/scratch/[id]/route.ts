import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const ticket = await prisma.scratchTicket.update({
    where: { id: parseInt(id) },
    data: {
      name: body.name,
      price: body.price,
      sheetsPerBook: body.sheetsPerBook,
      note: body.note || null,
    },
  })
  return NextResponse.json(ticket)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const ticket = await prisma.scratchTicket.update({
    where: { id: parseInt(id) },
    data: { active: body.active },
  })
  return NextResponse.json(ticket)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.scratchTicket.update({
    where: { id: parseInt(id) },
    data: { active: false },
  })
  return NextResponse.json({ ok: true })
}
