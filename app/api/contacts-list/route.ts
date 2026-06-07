import { NextRequest, NextResponse } from 'next/server'
import { getContactIntelligence } from '@/lib/sheets'
import { getContacts } from '@/lib/zoho'

export const dynamic = 'force-dynamic'

export interface ContactOption {
  name: string
  email: string
  title: string
  company: string
}

export async function GET(req: NextRequest) {
  const account = req.nextUrl.searchParams.get('account')?.toLowerCase().trim() ?? ''

  const [ciRes, zohoRes] = await Promise.allSettled([
    getContactIntelligence(),
    getContacts(),
  ])

  const contacts: ContactOption[] = []
  const seen = new Set<string>()

  if (ciRes.status === 'fulfilled') {
    for (const c of ciRes.value) {
      if (!c.name) continue
      if (account && !c.company.toLowerCase().includes(account)) continue
      const key = c.name.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        contacts.push({ name: c.name, email: c.email, title: c.title, company: c.company })
      }
    }
  }

  if (zohoRes.status === 'fulfilled') {
    for (const c of zohoRes.value) {
      const name = `${c.firstName} ${c.lastName}`.trim()
      if (!name) continue
      if (account && !c.accountName.toLowerCase().includes(account)) continue
      const key = name.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        contacts.push({ name, email: c.email, title: '', company: c.accountName })
      }
    }
  }

  return NextResponse.json({ contacts: contacts.sort((a, b) => a.name.localeCompare(b.name)) })
}
