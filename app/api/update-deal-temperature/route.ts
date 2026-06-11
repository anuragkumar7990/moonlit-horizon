import { NextRequest, NextResponse } from 'next/server'
import { updateDealTemperature } from '@/lib/zoho'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { dealId, temperature } = await req.json() as { dealId: string; temperature: 'Hot' | 'Warm' | 'Cold' | null }

  if (!dealId) return NextResponse.json({ error: 'dealId required' }, { status: 400 })

  try {
    await updateDealTemperature(dealId, temperature)
    return NextResponse.json({ ok: true, dealId, temperature })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
