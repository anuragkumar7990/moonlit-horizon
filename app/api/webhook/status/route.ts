import { NextResponse } from 'next/server'
import { getCalls } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const calls = await getCalls()
    const sorted = [...calls].sort((a, b) => (b.date > a.date ? 1 : -1))
    const last5  = sorted.slice(0, 5).map(c => ({
      date:        c.date,
      account:     c.account,
      outcome:     c.outcome,
      hasZohoId:   !!c.zohoCallId,
    }))
    return NextResponse.json({
      ok:          true,
      totalCalls:  calls.length,
      lastSynced:  sorted[0]?.date ?? null,
      last5,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
