import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(_: Request, { params }: { params: Promise<{ date: string }> }) {
  try {
    const { date } = await params
    await prisma.floorInventory.deleteMany({
      where: { date: new Date(date) },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
