import { NextRequest, NextResponse } from 'next/server'
import { appendCallRow } from '@/lib/sheets'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      account: string
      contactName?: string
      contactPhone?: string
      sdr?: string
      outcome: string
      notes?: string
      followUpDate?: string
    }

    const { account, contactName, contactPhone, sdr, outcome, notes, followUpDate } = body

    if (!account || !outcome) {
      return NextResponse.json({ error: 'account and outcome are required' }, { status: 400 })
    }

    // IST = UTC + 5:30
    const now = new Date()
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
    const date = ist.toISOString().slice(0, 10)
    const time = ist.toISOString().slice(11, 16)

    await appendCallRow({
      date,
      time,
      account,
      contactName: contactName ?? '',
      contactPhone: contactPhone ?? '',
      sdr: sdr ?? '',
      outcome,
      notes: notes ?? '',
      followUpDate: followUpDate ?? '',
    })

    return NextResponse.json({ ok: true, date, time })
  } catch (err: unknown) {
    console.error('[log-call]', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
