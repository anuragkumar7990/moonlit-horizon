import { NextResponse } from 'next/server'
import { updateLastContactDate } from '@/lib/sheets'

export async function POST(req: Request) {
  try {
    const { account, date } = await req.json()
    if (!account || !date) return NextResponse.json({ error: 'account and date required' }, { status: 400 })
    await updateLastContactDate(account, date)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
