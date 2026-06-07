import { NextResponse } from 'next/server'
import { getAccountIntelligence, getContactIntelligence } from '@/lib/sheets'
import { getZohoAccounts } from '@/lib/zoho'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [accountIntelRes, contactIntelRes, zohoRes] = await Promise.allSettled([
    getAccountIntelligence(),
    getContactIntelligence(),
    getZohoAccounts(),
  ])

  const names = new Set<string>()

  if (accountIntelRes.status === 'fulfilled') {
    for (const a of accountIntelRes.value) {
      if (a.account) names.add(a.account)
    }
  }
  if (contactIntelRes.status === 'fulfilled') {
    for (const c of contactIntelRes.value) {
      if (c.company) names.add(c.company)
    }
  }
  if (zohoRes.status === 'fulfilled') {
    for (const a of zohoRes.value) {
      if (a.accountName) names.add(a.accountName)
    }
  }

  return NextResponse.json({ accounts: Array.from(names).sort() })
}
