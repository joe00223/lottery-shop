import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function toTaipeiDateStr(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(d)
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get('date')
    const today = dateParam ?? toTaipeiDateStr(new Date())
    const todayDate = new Date(today)
    const yesterdayDate = new Date(todayDate.getTime() - 86400000)
    const yesterday = toTaipeiDateStr(yesterdayDate)

    const [tickets, floorToday, floorYesterday] = await Promise.all([
      prisma.scratchTicket.findMany({
        where: { active: true },
        orderBy: [{ price: 'asc' }, { name: 'asc' }],
      }),
      prisma.floorInventory.findMany({ where: { date: todayDate } }),
      prisma.floorInventory.findMany({ where: { date: yesterdayDate } }),
    ])

    const todayMap = Object.fromEntries(floorToday.map(r => [r.scratchTicketId, r]))
    const yestMap = Object.fromEntries(floorYesterday.map(r => [r.scratchTicketId, r]))

    const rows = tickets.map(t => {
      const td = todayMap[t.id]
      const yd = yestMap[t.id]
      const yesterdayDisplay = yd?.onDisplay ?? 0
      const supplement =
        ((yd?.unopened ?? 0) - (td?.unopened ?? 0)) * t.sheetsPerBook +
        ((yd?.opened ?? 0) - (td?.opened ?? 0))
      const restockSheets = td?.restockSheets ?? 0
      const todayDisplay = td?.onDisplay ?? 0
      const sold = yesterdayDisplay + supplement + restockSheets - todayDisplay
      return {
        id: t.id,
        name: t.name,
        price: t.price,
        sheetsPerBook: t.sheetsPerBook,
        yesterdayDisplay,
        supplement,
        restockSheets,
        todayDisplay,
        sold,
      }
    })

    return NextResponse.json({ date: today, yesterday, rows })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
