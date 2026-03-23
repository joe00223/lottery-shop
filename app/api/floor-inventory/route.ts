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
    const key = {
      date_scratchTicketId: {
        date: new Date(body.date),
        scratchTicketId: body.scratchTicketId,
      },
    }
    // Only update fields that are explicitly provided
    const update: Record<string, number> = {}
    if (body.unopened !== undefined) update.unopened = body.unopened
    if (body.opened !== undefined) update.opened = body.opened
    if (body.onDisplay !== undefined) update.onDisplay = body.onDisplay
    if (body.restockSheets !== undefined) update.restockSheets = body.restockSheets

    const record = await prisma.floorInventory.upsert({
      where: key,
      update,
      create: {
        date: new Date(body.date),
        scratchTicketId: body.scratchTicketId,
        unopened: body.unopened ?? 0,
        opened: body.opened ?? 0,
        onDisplay: body.onDisplay ?? 0,
        restockSheets: body.restockSheets ?? 0,
      },
    })
    return NextResponse.json(record)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
