import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const employees = await prisma.employee.findMany({
    where: { active: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(employees)
}

export async function POST(req: Request) {
  const body = await req.json()
  const employee = await prisma.employee.create({
    data: { name: body.name, color: body.color },
  })
  return NextResponse.json(employee)
}
