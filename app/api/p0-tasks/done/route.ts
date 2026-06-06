import { NextRequest, NextResponse } from 'next/server'
import { updateTaskStatus } from '@/lib/sheets'

export async function POST(req: NextRequest) {
  const { linkedDeal } = await req.json()
  if (!linkedDeal) return NextResponse.json({ error: 'linkedDeal is required' }, { status: 400 })
  await updateTaskStatus(linkedDeal, 'Done')
  return NextResponse.json({ ok: true })
}
