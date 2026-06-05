import { NextResponse } from 'next/server'
import { getLeads } from '@/lib/zoho'

export const dynamic = 'force-dynamic'

export async function GET() {
  const leads = await getLeads()
  return NextResponse.json(leads)
}
