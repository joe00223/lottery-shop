import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DAY_NAMES = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
const TZ = 'Asia/Taipei'

/** 把任意 Date 轉成台灣日期字串 YYYY-MM-DD */
function toTwDateStr(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: TZ }) // en-CA → 'YYYY-MM-DD'
}

/** 把 'YYYY-MM-DD' 拆成 [year, month0, day]（month 從 0 算） */
function parseDateStr(s: string): [number, number, number] {
  const [y, m, d] = s.split('-').map(Number)
  return [y, m - 1, d]
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)

  const startStr = searchParams.get('start') ?? '' // 'YYYY-MM-DD' 台灣日期
  const endStr   = searchParams.get('end')   ?? ''
  if (!startStr || !endStr) return NextResponse.json({ shifts: [], totalHours: 0 })

  const [sy, sm, sd] = parseDateStr(startStr)
  const [ey, em, ed] = parseDateStr(endStr)

  // weekStart 存的是「台灣週一的 ISO 時間（UTC）」，實際是台灣午夜 = UTC 前一天 16:00
  // 用 UTC 日期做區間：最早抓 start-6 天，最晚抓 end 當天
  const qStart = new Date(Date.UTC(sy, sm, sd - 6))           // startStr - 6 天，UTC 0:00
  const qEnd   = new Date(Date.UTC(ey, em, ed + 1))            // endStr + 1 天，UTC 0:00（lte 用）

  const schedules = await prisma.schedule.findMany({
    where: {
      employeeId: parseInt(id),
      weekStart: { gte: qStart, lt: qEnd },
    },
    orderBy: [{ weekStart: 'asc' }, { dayOfWeek: 'asc' }, { hour: 'asc' }],
  })

  // 以台灣日期為 key 做 group，Set 去重（避免同日多 rowIndex 重複計算）
  const byDate = new Map<string, { m: number; d: number; dow: number; hours: Set<number> }>()

  for (const s of schedules) {
    // weekStart → 台灣日期字串，再加 offset 天得到實際班次日期
    const wsStr = toTwDateStr(new Date(s.weekStart))
    const [wy, wm, wd] = parseDateStr(wsStr)
    const offset = s.dayOfWeek === 0 ? 6 : s.dayOfWeek - 1

    // 用 Date.UTC 做純日期加法，避免本地時區介入
    const actual = new Date(Date.UTC(wy, wm, wd + offset))
    const actualStr = actual.toISOString().slice(0, 10) // 'YYYY-MM-DD'

    // 只保留範圍內
    if (actualStr < startStr || actualStr > endStr) continue

    if (!byDate.has(actualStr)) {
      const [, am, ad] = parseDateStr(actualStr)
      byDate.set(actualStr, { m: am + 1, d: ad, dow: actual.getUTCDay(), hours: new Set() })
    }
    byDate.get(actualStr)!.hours.add(s.hour)
  }

  // 依日期字串排序（字典序 = 時間序）
  const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))

  const shifts: Array<{
    date: string; dayName: string; startTime: string; endTime: string; hours: number
  }> = []

  for (const [, { m, d, dow, hours: hoursSet }] of sorted) {
    const hours = [...hoursSet].sort((a, b) => a - b)
    let i = 0
    while (i < hours.length) {
      let j = i + 1
      while (j < hours.length && hours[j] === hours[j - 1] + 1) j++
      shifts.push({
        date: `${m}月${d}日`,
        dayName: DAY_NAMES[dow],
        startTime: `${String(hours[i]).padStart(2, '0')}:00`,
        endTime:   `${String(hours[j - 1] + 1).padStart(2, '0')}:00`,
        hours: j - i,
      })
      i = j
    }
  }

  const totalHours = shifts.reduce((s, r) => s + r.hours, 0)
  return NextResponse.json({ shifts, totalHours })
}
