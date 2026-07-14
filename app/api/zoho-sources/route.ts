import { NextRequest, NextResponse } from 'next/server'
import { getLvl2SourceValues, getPicklistValues, addPicklistValue } from '@/lib/zoho'

export const dynamic = 'force-dynamic'

// Fields this route is allowed to extend — an allowlist, not fully arbitrary,
// since this PATCHes Leads field configuration in live Zoho.
const ALLOWED_FIELDS = ['Lvl_1_Source', 'Lvl_2_Source'] as const
type AllowedField = typeof ALLOWED_FIELDS[number]

export async function GET(req: NextRequest) {
  try {
    const field = (req.nextUrl.searchParams.get('field') ?? 'Lvl_2_Source') as AllowedField
    if (!ALLOWED_FIELDS.includes(field)) {
      return NextResponse.json({ error: `field must be one of ${ALLOWED_FIELDS.join(', ')}` }, { status: 400 })
    }
    const values = field === 'Lvl_2_Source' ? await getLvl2SourceValues() : await getPicklistValues('Leads', field)
    return NextResponse.json({ values })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { value, field = 'Lvl_2_Source' } = await req.json() as { value?: string; field?: AllowedField }
    if (!value?.trim()) return NextResponse.json({ error: 'Value is required' }, { status: 400 })
    if (!ALLOWED_FIELDS.includes(field)) {
      return NextResponse.json({ error: `field must be one of ${ALLOWED_FIELDS.join(', ')}` }, { status: 400 })
    }
    await addPicklistValue('Leads', field, value.trim())
    return NextResponse.json({ ok: true, value: value.trim(), field })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
