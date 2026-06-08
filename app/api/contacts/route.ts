import { NextResponse } from 'next/server'
import { getContacts } from '@/lib/zoho'
import { getContactIntelligence } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export interface EnrichedContact {
  id: string
  name: string
  email: string
  phone: string
  accountName: string
  // from Contact Intelligence sheet (empty if no calling history)
  title: string
  totalCalls: number
  connectedCalls: number
  connectionRate: number
  lastCallDate: string
  lastCallOutcome: string
  zohoStage: string
  sdr: string
}

export async function GET() {
  try {
    const [zohoContacts, ciRows] = await Promise.all([
      getContacts(),
      getContactIntelligence(),
    ])

    // Build email → CI row map for enrichment
    const ciMap = new Map<string, typeof ciRows[0]>()
    for (const row of ciRows) {
      if (row.email) ciMap.set(row.email.toLowerCase(), row)
    }

    const contacts: EnrichedContact[] = zohoContacts.map(c => {
      const ci = ciMap.get(c.email.toLowerCase())
      return {
        id:              c.id,
        name:            [c.firstName, c.lastName].filter(Boolean).join(' ') || '—',
        email:           c.email,
        phone:           c.phone,
        accountName:     c.accountName,
        title:           ci?.title           ?? '',
        totalCalls:      ci?.totalCalls      ?? 0,
        connectedCalls:  ci?.connectedCalls  ?? 0,
        connectionRate:  ci?.connectionRate  ?? 0,
        lastCallDate:    ci?.lastCallDate    ?? '',
        lastCallOutcome: ci?.lastCallOutcome ?? '',
        zohoStage:       ci?.zohoStage       ?? '',
        sdr:             ci?.sdr             ?? '',
      }
    })

    // Sort by name
    contacts.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ contacts, total: contacts.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
