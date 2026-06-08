import { NextRequest, NextResponse } from 'next/server'
import { updateDealStage } from '@/lib/zoho'
import { appendLostDeal } from '@/lib/sheets'
import type { LostDealCategory } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { dealId, dealName, account, contactEmail, category, notes } = await req.json() as {
    dealId: string
    dealName: string
    account: string
    contactEmail?: string
    category: LostDealCategory
    notes?: string
  }

  if (!dealId || !dealName || !account || !category) {
    return NextResponse.json({ error: 'dealId, dealName, account, category required' }, { status: 400 })
  }

  try {
    await Promise.all([
      updateDealStage(dealId, 'Lost'),
      appendLostDeal({ dealId, dealName, account, contactEmail: contactEmail ?? '', category, dateMoved: '', notes: notes ?? '' }),
    ])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
