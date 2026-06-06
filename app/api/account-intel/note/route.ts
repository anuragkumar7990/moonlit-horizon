import { NextRequest, NextResponse } from 'next/server'
import { appendManualNote } from '@/lib/sheets'
import { regenerateCumulative } from '@/lib/intel'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { account: string; note: string }
    const { account, note } = body
    if (!account || !note?.trim()) {
      return NextResponse.json({ error: 'account and note are required' }, { status: 400 })
    }

    const updatedNotes = await appendManualNote(account, note.trim())
    const { cumulativeSummary, nextAction } = await regenerateCumulative(account)

    return NextResponse.json({ ok: true, updatedNotes, cumulativeSummary, nextAction })
  } catch (err) {
    console.error('[account-intel/note]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
