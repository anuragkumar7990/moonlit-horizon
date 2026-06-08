import { NextRequest, NextResponse } from 'next/server'
import { addTagToDeals, removeTagFromDeals } from '@/lib/zoho'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { dealId, temperature } = await req.json() as { dealId: string; temperature: 'Hot' | 'Warm' | 'Cold' | null }

  if (!dealId) return NextResponse.json({ error: 'dealId required' }, { status: 400 })

  try {
    for (const tag of ['Hot', 'Warm', 'Cold']) {
      await removeTagFromDeals([dealId], tag)
    }
    if (temperature) {
      await addTagToDeals([dealId], temperature)
    }
    return NextResponse.json({ ok: true, dealId, temperature })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
