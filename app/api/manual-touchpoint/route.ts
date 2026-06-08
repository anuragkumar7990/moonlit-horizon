import { NextRequest, NextResponse } from 'next/server'
import { appendManualTouchpoint, getContactIntelligence } from '@/lib/sheets'
import { updateLastContactDate } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    email?: string
    type?: string
    date?: string
    notes?: string
    loggedBy?: string
  }

  if (!body.email) return NextResponse.json({ error: 'email is required' }, { status: 400 })
  if (body.type !== 'WhatsApp' && body.type !== 'In-person') {
    return NextResponse.json({ error: 'type must be WhatsApp or In-person' }, { status: 400 })
  }

  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const date = body.date ?? now.toISOString().slice(0, 10)

  await appendManualTouchpoint(
    body.email,
    date,
    body.type,
    body.notes ?? '',
    body.loggedBy ?? 'Dashboard'
  )

  // Best-effort: update Account Intel last contact date
  getContactIntelligence()
    .then(rows => {
      const row = rows.find(r => r.email.toLowerCase() === body.email!.toLowerCase())
      if (row?.company) return updateLastContactDate(row.company, date)
    })
    .catch(() => { /* best effort */ })

  return NextResponse.json({ ok: true })
}
