import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: { date?: { gte?: Date; lte?: Date } } = {}
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) where.date.lte = new Date(to)
    }

    const records = await prisma.floorInventory.findMany({
      where,
      orderBy: { date: 'desc' },
    })

    // Group by date string
    const grouped: Record<string, typeof records> = {}
    for (const r of records) {
      const key = r.date.toISOString().split('T')[0]
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(r)
    }

    return NextResponse.json(grouped)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const record = await prisma.floorInventory.upsert({
      where: {
        date_scratchTicketId: {
          date: new Date(body.date),
          scratchTicketId: body.scratchTicketId,
        },
      },
      update: {
        unopened: body.unopened ?? 0,
        opened: body.opened ?? 0,
        onDisplay: body.onDisplay ?? 0,
      },
      create: {
        date: new Date(body.date),
        scratchTicketId: body.scratchTicketId,
        unopened: body.unopened ?? 0,
        opened: body.opened ?? 0,
        onDisplay: body.onDisplay ?? 0,
      },
    })
    return NextResponse.json(record)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
