import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const tickets = await prisma.scratchTicket.findMany({
      where: { active: true },
      orderBy: { price: 'asc' },
      include: {
        inventoryLogs: {
          orderBy: { time: 'desc' },
        },
      },
    })

    const result = tickets.map((t) => {
      const stock = t.inventoryLogs.reduce((sum, log) => {
        return log.type === 'IN' ? sum + log.books : sum - log.books
      }, 0)
      return { ...t, stock }
    })

    return NextResponse.json(result)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const body = await req.json()
  const log = await prisma.scratchInventoryLog.create({
    data: {
      scratchTicketId: body.scratchTicketId,
      type: body.type,
      books: body.books,
      time: body.time ? new Date(body.time) : new Date(),
      note: body.note || null,
    },
    include: { scratchTicket: true },
  })
  return NextResponse.json(log)
}
