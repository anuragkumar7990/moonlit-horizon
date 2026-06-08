import { NextResponse } from 'next/server'
import { getContacts, getLeads } from '@/lib/zoho'
import { getContactIntelligence, getAccountIntelligence, getManualTouchpoints, type ManualTouchpoint } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export interface TrackerContact {
  name: string
  accountName: string
  phone: string
  email: string
  lastContactDate: string
  lastTouchpointType: 'Call' | 'Email' | 'Google Meet' | 'WhatsApp' | 'In-person' | null
  daysSinceContact: number | null
}

function maxDate(...dates: string[]): string {
  return dates.filter(Boolean).sort().pop() ?? ''
}

function todayIST(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function daysBetween(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date(todayIST())
  return Math.floor((now.getTime() - d.getTime()) / 86400000)
}

export async function GET() {
  const [contacts, leads, ciRows, aiRows, touchpoints] = await Promise.all([
    getContacts().catch(() => []),
    getLeads().catch(() => []),
    getContactIntelligence().catch(() => []),
    getAccountIntelligence().catch(() => []),
    getManualTouchpoints().catch(() => []),
  ])

  // Build lookup maps (all email keys lowercased)
  const ciMap = new Map(ciRows.filter(r => r.email).map(r => [r.email.toLowerCase(), r]))
  const aiMap = new Map(aiRows.map(r => [r.account.toLowerCase(), r]))

  // Group manual touchpoints by email, sorted desc by date
  const mtMap = new Map<string, ManualTouchpoint[]>()
  for (const tp of touchpoints) {
    const key = tp.email.toLowerCase()
    if (!mtMap.has(key)) mtMap.set(key, [])
    mtMap.get(key)!.push(tp)
  }
  mtMap.forEach(arr => arr.sort((a, b) => b.date.localeCompare(a.date)))

  // Deduplicate: contacts by ID, leads by email (skip if contact with same email exists)
  const seenIds  = new Set<string>()
  const seenEmails = new Set<string>()
  const people: { name: string; accountName: string; phone: string; email: string }[] = []

  for (const c of contacts) {
    if (seenIds.has(c.id)) continue
    seenIds.add(c.id)
    if (c.email) seenEmails.add(c.email.toLowerCase())
    people.push({
      name: `${c.firstName} ${c.lastName}`.trim() || c.email || c.id,
      accountName: c.accountName,
      phone: c.phone,
      email: c.email,
    })
  }

  for (const l of leads) {
    if (l.email && seenEmails.has(l.email.toLowerCase())) continue
    people.push({
      name: `${l.firstName} ${l.lastName}`.trim() || l.email || l.id,
      accountName: l.company,
      phone: l.phone,
      email: l.email,
    })
  }

  const today = todayIST()

  const result: TrackerContact[] = people.map(person => {
    const emailKey   = person.email.toLowerCase()
    const accountKey = person.accountName.toLowerCase()

    const ci          = emailKey ? ciMap.get(emailKey) : undefined
    const ai          = accountKey ? aiMap.get(accountKey) : undefined
    const latestManual = emailKey ? (mtMap.get(emailKey)?.[0] ?? null) : null

    const callDate    = ci?.lastCallDate ?? ''
    const accountDate = ai?.lastContactDate ?? ''
    const manualDate  = latestManual?.date ?? ''

    const lastContactDate = maxDate(callDate, accountDate, manualDate)

    let lastTouchpointType: TrackerContact['lastTouchpointType'] = null

    if (lastContactDate) {
      if (manualDate && manualDate === lastContactDate) {
        lastTouchpointType = latestManual!.type
      } else if (accountDate && accountDate === lastContactDate && ai) {
        if (ai.emailIntelligence?.includes(accountDate)) lastTouchpointType = 'Email'
        else if (ai.circlebakIntelligence?.includes(accountDate)) lastTouchpointType = 'Google Meet'
        else lastTouchpointType = 'Call'
      } else if (callDate) {
        lastTouchpointType = 'Call'
      }
    }

    const daysSinceContact = lastContactDate ? daysBetween(lastContactDate) : null
    const phone = ci?.phone || person.phone

    return {
      name: person.name,
      accountName: person.accountName,
      phone,
      email: person.email,
      lastContactDate,
      lastTouchpointType,
      daysSinceContact,
    }
  })

  // Oldest contact first; never-contacted at the end
  result.sort((a, b) => {
    const da = a.daysSinceContact ?? -1
    const db = b.daysSinceContact ?? -1
    return db - da
  })

  return NextResponse.json({ contacts: result, total: result.length, asOf: today })
}
