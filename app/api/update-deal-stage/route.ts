import { NextRequest, NextResponse } from 'next/server'
import { updateDealStage } from '@/lib/zoho'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { dealId, stage } = await req.json() as { dealId: string; stage: string }
  if (!dealId || !stage) return NextResponse.json({ error: 'dealId and stage required' }, { status: 400 })
  try {
    await updateDealStage(dealId, stage)
    return NextResponse.json({ ok: true, dealId, stage })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
