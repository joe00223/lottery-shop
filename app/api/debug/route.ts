import { NextResponse } from 'next/server'

export async function GET() {
  const url = process.env.DATABASE_URL ?? 'NOT SET'
  try {
    const parsed = new URL(url)
    return NextResponse.json({
      host: parsed.hostname,
      port: parsed.port,
      user: parsed.username,
      db: parsed.pathname,
    })
  } catch {
    return NextResponse.json({ error: 'invalid url', first20: url.substring(0, 20) })
  }
}
