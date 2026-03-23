import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function toDateStr(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(d)
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') ?? '')
    const month = parseInt(searchParams.get('month') ?? '') // 1-12
    if (!year || !month) return NextResponse.json({ error: 'year and month required' }, { status: 400 })

    const firstDay = new Date(`${year}-${String(month).padStart(2, '0')}-01`)
    const lastDay = new Date(year, month, 0) // last day of month
    const dayBefore = new Date(firstDay.getTime() - 86400000)

    const [tickets, summaries, floorRecords, extraItems] = await Promise.all([
      prisma.scratchTicket.findMany({
        where: { active: true },
        orderBy: [{ price: 'asc' }, { name: 'asc' }],
      }),
      prisma.dailySummary.findMany({
        where: { date: { gte: firstDay, lte: lastDay } },
      }),
      prisma.floorInventory.findMany({
        where: { date: { gte: dayBefore, lte: lastDay } },
      }),
      prisma.dailySummaryItem.findMany({
        where: { date: { gte: firstDay, lte: lastDay } },
      }),
    ])

    // floor map: dateStr -> ticketId -> record
    const floorMap: Record<string, Record<number, (typeof floorRecords)[0]>> = {}
    for (const r of floorRecords) {
      const key = toDateStr(r.date)
      if (!floorMap[key]) floorMap[key] = {}
      floorMap[key][r.scratchTicketId] = r
    }

    // summary map
    const summaryMap: Record<string, (typeof summaries)[0]> = {}
    for (const s of summaries) summaryMap[toDateStr(s.date)] = s

    // extra items map
    const extraMap: Record<string, number> = {}
    for (const item of extraItems) {
      const key = toDateStr(item.date)
      extraMap[key] = (extraMap[key] ?? 0) + item.amount
    }

    // build all days in month
    const days: string[] = []
    const cur = new Date(firstDay)
    while (cur <= lastDay) {
      days.push(toDateStr(cur))
      cur.setDate(cur.getDate() + 1)
    }

    const rows = days.map(dateStr => {
      const yesterday = toDateStr(new Date(new Date(dateStr).getTime() - 86400000))
      const s = summaryMap[dateStr]

      // scratch sales calculation (same formula as checkout API)
      let scratchSales = 0
      for (const t of tickets) {
        const td = floorMap[dateStr]?.[t.id]
        const yd = floorMap[yesterday]?.[t.id]
        const yesterdayDisplay = yd?.onDisplay ?? 0
        const supplement =
          ((yd?.unopened ?? 0) - (td?.unopened ?? 0)) * t.sheetsPerBook +
          ((yd?.opened ?? 0) - (td?.opened ?? 0))
        const restockSheets = td?.restockSheets ?? 0
        const todayDisplay = td?.onDisplay ?? 0
        const sold = yesterdayDisplay + supplement + restockSheets - todayDisplay
        scratchSales += sold * t.price
      }

      return {
        date: dateStr,
        lotterySales: s?.lotterySales ?? 0,
        lotteryRedemption: s?.lotteryRedemption ?? 0,
        scratchSales,
        scratchRedemption: s?.scratchRedemption ?? 0,
        sportsSales: s?.sportsSales ?? 0,
        sportsRedemption: s?.sportsRedemption ?? 0,
        extra: extraMap[dateStr] ?? 0,
      }
    })

    return NextResponse.json({ year, month, rows })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
