import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const all = new URL(req.url).searchParams.get('all') === '1'
  const tickets = await prisma.scratchTicket.findMany({
    where: all ? undefined : { active: true },
    orderBy: { price: 'asc' },
  })
  return NextResponse.json(tickets)
}

export async function POST(req: Request) {
  const body = await req.json()
  const ticket = await prisma.scratchTicket.create({
    data: {
      name: body.name,
      price: body.price,
      sheetsPerBook: body.sheetsPerBook,
      note: body.note || null,
    },
  })
  return NextResponse.json(ticket)
}
