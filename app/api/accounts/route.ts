import { NextResponse } from 'next/server'
import { getZohoAccounts } from '@/lib/zoho'

export const revalidate = 60

export async function GET() {
  const accounts = await getZohoAccounts()
  return NextResponse.json(accounts)
}
