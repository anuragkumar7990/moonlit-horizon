import { NextResponse } from 'next/server'
import { getLvl2SourceValues, addLvl2SourceValue } from '@/lib/zoho'
import { getEmailListCounts } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export const EMAIL_CATEGORIES = [
  'Email - QA Domestic',
  'Email - QA International',
  'Email - Engineering Domestic',
  'Email - Engineering International',
  'Email - L&D Domestic',
]

export async function GET() {
  try {
    // Seed any missing Zoho Lvl2 picklist values (sequentially — Zoho PATCH is stateful)
    const existing = await getLvl2SourceValues()
    for (const cat of EMAIL_CATEGORIES) {
      if (!existing.includes(cat)) {
        await addLvl2SourceValue(cat)
      }
    }

    const counts = await getEmailListCounts()
    return NextResponse.json({ counts })
  } catch (err) {
    console.error('[/api/email-lists]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
