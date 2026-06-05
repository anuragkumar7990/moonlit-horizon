import { NextRequest, NextResponse } from 'next/server'
import { getLvl2SourceValues, addLvl2SourceValue } from '@/lib/zoho'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const values = await getLvl2SourceValues()
    return NextResponse.json({ values })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { value } = await req.json() as { value?: string }
    if (!value?.trim()) return NextResponse.json({ error: 'Value is required' }, { status: 400 })
    await addLvl2SourceValue(value.trim())
    return NextResponse.json({ ok: true, value: value.trim() })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
