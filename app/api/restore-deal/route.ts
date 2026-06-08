import { NextRequest, NextResponse } from 'next/server'
import { updateDealStage } from '@/lib/zoho'
import { deleteLostDealRow } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { sheetRowIndex, dealId, targetStage } = await req.json() as {
    sheetRowIndex: number
    dealId: string
    targetStage: string
  }

  if (!dealId || !targetStage || !sheetRowIndex) {
    return NextResponse.json({ error: 'sheetRowIndex, dealId, targetStage required' }, { status: 400 })
  }

  try {
    await Promise.all([
      updateDealStage(dealId, targetStage),
      deleteLostDealRow(sheetRowIndex),
    ])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
