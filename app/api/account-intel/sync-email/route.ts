import { NextRequest, NextResponse } from 'next/server'
import { syncEmailIntel, type EmailThread } from '@/lib/intel'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { account: string; threads: EmailThread[] }
    const { account, threads } = body
    if (!account || !Array.isArray(threads)) {
      return NextResponse.json({ error: 'account and threads[] are required' }, { status: 400 })
    }

    const { cumulativeSummary, nextAction } = await syncEmailIntel(account, threads)
    return NextResponse.json({ ok: true, cumulativeSummary, nextAction })
  } catch (err) {
    console.error('[account-intel/sync-email]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
