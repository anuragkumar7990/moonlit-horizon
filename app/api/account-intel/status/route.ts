import { NextRequest, NextResponse } from 'next/server'
import { updateAccountStatus, type AccountIntelligence } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['Won', 'Active', 'Warm', 'Cold', 'Dead']

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { account: string; status: string }
    const { account, status } = body
    if (!account || !status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'account and valid status are required' }, { status: 400 })
    }

    await updateAccountStatus(account, status as AccountIntelligence['status'])
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[account-intel/status]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
