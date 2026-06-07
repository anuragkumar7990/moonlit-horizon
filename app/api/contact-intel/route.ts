import { NextResponse } from 'next/server'
import { getContactIntelligence } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const contacts = await getContactIntelligence()
    return NextResponse.json(
      { contacts },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' } }
    )
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
