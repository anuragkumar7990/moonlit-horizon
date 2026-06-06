import { NextRequest, NextResponse } from 'next/server'
import { getNotes } from '@/lib/sheets'
import { generateAndSaveIntel } from '@/lib/intel'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { account: string }
    const { account } = body
    if (!account) {
      return NextResponse.json({ error: 'account is required' }, { status: 400 })
    }

    const allNotes = await getNotes()
    const accountNotes = allNotes.filter(n =>
      n.accountName.toLowerCase().trim() === account.toLowerCase().trim() && n.summary
    )

    if (accountNotes.length === 0) {
      return NextResponse.json({ error: `No notes found for "${account}" in the Notes tab` }, { status: 404 })
    }

    const intel = await generateAndSaveIntel(
      account,
      accountNotes.map(n => ({
        date: n.createdAt,
        notes: n.summary + (n.actionables ? '\n' + n.actionables : ''),
      }))
    )

    return NextResponse.json({ ok: true, intel })
  } catch (err) {
    console.error('[account-intel/refresh]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
