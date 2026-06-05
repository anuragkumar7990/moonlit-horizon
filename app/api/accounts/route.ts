import { NextResponse } from 'next/server'
import { getZohoAccounts } from '@/lib/zoho'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const accounts = await getZohoAccounts()
    return NextResponse.json(accounts)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
