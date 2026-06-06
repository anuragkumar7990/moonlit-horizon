import { NextRequest, NextResponse } from 'next/server'
import { getAccountIntelligence } from '@/lib/sheets'
import { generateAndSaveIntel, type MeetingInput } from '@/lib/intel'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const intel = await getAccountIntelligence()
    return NextResponse.json({ intel })
  } catch (err) {
    console.error('[account-intel GET]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      account: string
      meetings: MeetingInput[]
    }

    const { account, meetings } = body
    if (!account || !meetings?.length) {
      return NextResponse.json({ error: 'account and meetings[] are required' }, { status: 400 })
    }

    const intel = await generateAndSaveIntel(account, meetings)
    return NextResponse.json({ ok: true, intel })
  } catch (err) {
    console.error('[account-intel POST]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
