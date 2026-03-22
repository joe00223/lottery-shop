import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const employee = await prisma.employee.update({
    where: { id: parseInt(id) },
    data: { name: body.name, color: body.color, active: body.active },
  })
  return NextResponse.json(employee)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.employee.update({
    where: { id: parseInt(id) },
    data: { active: false },
  })
  return NextResponse.json({ ok: true })
}
