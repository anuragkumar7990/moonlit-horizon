import { NextResponse } from 'next/server'
import { syncCallIntel } from '@/lib/intel'

// Called after a new call is logged (Discord /mh log call or Zoho webhook)
// Body: { account: string, date?: string }
export async function POST(req: Request) {
  try {
    const { account, date } = await req.json()
    if (!account) return NextResponse.json({ error: 'account required' }, { status: 400 })

    const result = await syncCallIntel(account, date)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[intel-trigger/call]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
