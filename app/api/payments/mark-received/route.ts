import { NextRequest, NextResponse } from 'next/server'
import { updatePaymentStatus, updateAccountStatus } from '@/lib/sheets'
import { getDeals, updateDealStage } from '@/lib/zoho'
import type { Payment, AccountIntelligence } from '@/lib/sheets'

export async function POST(req: NextRequest) {
  try {
    const { rowIndex, status, account, deal } = await req.json() as {
      rowIndex: number
      status: Payment['status']
      account?: string
      deal?: string
    }
    if (!rowIndex || !status) {
      return NextResponse.json({ error: 'rowIndex and status are required' }, { status: 400 })
    }

    await updatePaymentStatus(rowIndex, status)

    if (account && status === 'Received') {
      // Cascade: Zoho deal → Won
      try {
        const deals = await getDeals()
        const matched = deals.find(d =>
          d.accountName.toLowerCase() === account.toLowerCase() &&
          (!deal || d.dealName.toLowerCase().includes(deal.toLowerCase()))
        )
        if (matched) await updateDealStage(matched.id, 'Won')
      } catch { /* non-fatal */ }

      // Cascade: Account Intelligence status → Won
      await updateAccountStatus(account, 'Won' as AccountIntelligence['status']).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
