import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await req.json()
  const item = await prisma.extraItemTemplate.update({ where: { id: parseInt(id) }, data })
  return NextResponse.json(item)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.extraItemTemplate.delete({ where: { id: parseInt(id) } })
  return NextResponse.json({ ok: true })
}
