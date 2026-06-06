import { NextRequest, NextResponse } from 'next/server'
import { appendCallRow } from '@/lib/sheets'
import { createZohoCall } from '@/lib/zoho'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      account: string
      contactName?: string
      contactPhone?: string
      contactId?: string
      contactType?: 'lead' | 'contact'
      sdr?: string
      outcome: string
      notes?: string
      followUpDate?: string
    }

    const { account, contactName, contactPhone, contactId, contactType, sdr, outcome, notes, followUpDate } = body

    if (!account || !outcome) {
      return NextResponse.json({ error: 'account and outcome are required' }, { status: 400 })
    }

    const now = new Date()
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
    const date = ist.toISOString().slice(0, 10)
    const time = ist.toISOString().slice(11, 16)

    // Write to Sheets
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

    // Write to Zoho Calls module (best-effort — don't fail the whole request if this errors)
    if (contactId && contactType) {
      createZohoCall({
        contactId,
        contactType,
        accountName: account,
        outcome,
        notes,
      }).catch(err => console.error('[log-call] Zoho write failed (non-fatal):', err.message))
    }

    return NextResponse.json({ ok: true, date, time })
  } catch (err: unknown) {
    console.error('[log-call]', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
