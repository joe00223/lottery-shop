import { NextResponse } from 'next/server'
import { COOKIE_NAME, COOKIE_MAX_AGE, computeExpectedToken } from '@/lib/auth'

export async function POST(req: Request) {
  const { password } = await req.json()

  if (!password || password !== process.env.AUTH_PASSWORD) {
    return NextResponse.json({ error: '密碼錯誤' }, { status: 401 })
  }

  const token = await computeExpectedToken()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
  return res
}
