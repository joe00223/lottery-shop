export const DAYS = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']
export const DAY_KEYS = ['1', '2', '3', '4', '5', '6', '0'] // Mon=1...Sun=0 matching JS Date

export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  return `${weekStart.getMonth() + 1}/${weekStart.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`
}

export function parseHour(timeStr: string): number {
  return parseInt(timeStr.split(':')[0])
}

export type DayHours = {
  open: string
  close: string
}

export type StoreHours = {
  [key: string]: DayHours
}
