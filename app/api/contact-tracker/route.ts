import { NextResponse } from 'next/server'
import { getContacts, getLeads } from '@/lib/zoho'
import { getContactIntelligence, getAccountIntelligence, getManualTouchpoints } from '@/lib/sheets'

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
    getContacts(),
    getLeads(),
    getContactIntelligence(),
    getAccountIntelligence(),
    getManualTouchpoints(),
  ])

  // Build lookup maps (all email keys lowercased)
  const ciMap = new Map(ciRows.map(r => [r.email.toLowerCase(), r]))
  const aiMap = new Map(aiRows.map(r => [r.account.toLowerCase(), r]))

  // Group manual touchpoints by email, sorted desc by date
  const mtMap = new Map<string, typeof touchpoints>()
  for (const tp of touchpoints) {
    const key = tp.email.toLowerCase()
    if (!mtMap.has(key)) mtMap.set(key, [])
    mtMap.get(key)!.push(tp)
  }
  mtMap.forEach(arr => arr.sort((a, b) => b.date.localeCompare(a.date)))

  // Deduplicate: contacts first, then leads not already represented
  const seen = new Set<string>()
  const people: { name: string; accountName: string; phone: string; email: string }[] = []

  for (const c of contacts) {
    const emailKey = c.email.toLowerCase()
    if (!emailKey || seen.has(emailKey)) continue
    seen.add(emailKey)
    people.push({
      name: `${c.firstName} ${c.lastName}`.trim() || c.email,
      accountName: c.accountName,
      phone: c.phone,
      email: c.email,
    })
  }

  for (const l of leads) {
    const emailKey = l.email.toLowerCase()
    if (!emailKey || seen.has(emailKey)) continue
    seen.add(emailKey)
    people.push({
      name: `${l.firstName} ${l.lastName}`.trim() || l.email,
      accountName: l.company,
      phone: l.phone,
      email: l.email,
    })
  }

  const today = todayIST()

  const result: TrackerContact[] = people.map(person => {
    const emailKey = person.email.toLowerCase()
    const accountKey = person.accountName.toLowerCase()

    const ci = ciMap.get(emailKey)
    const ai = aiMap.get(accountKey)
    const latestManual = mtMap.get(emailKey)?.[0] ?? null

    const callDate     = ci?.lastCallDate ?? ''
    const accountDate  = ai?.lastContactDate ?? ''
    const manualDate   = latestManual?.date ?? ''

    const lastContactDate = maxDate(callDate, accountDate, manualDate)

    let lastTouchpointType: TrackerContact['lastTouchpointType'] = null

    if (lastContactDate) {
      if (manualDate && manualDate === lastContactDate) {
        lastTouchpointType = latestManual!.type
      } else if (accountDate && accountDate === lastContactDate) {
        // Infer from which Account Intel layer contains this date
        const ai2 = ai!
        if (ai2.emailIntelligence?.includes(accountDate)) {
          lastTouchpointType = 'Email'
        } else if (ai2.circlebakIntelligence?.includes(accountDate)) {
          lastTouchpointType = 'Google Meet'
        } else {
          lastTouchpointType = 'Call'
        }
      } else if (callDate && callDate === lastContactDate) {
        lastTouchpointType = 'Call'
      }
    }

    const daysSinceContact = lastContactDate
      ? daysBetween(lastContactDate)
      : null

    // Prefer phone from Contact Intelligence (may have more complete data)
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

  // Sort: never-contacted last; otherwise oldest first (highest daysSinceContact first)
  result.sort((a, b) => {
    const da = a.daysSinceContact ?? Infinity
    const db = b.daysSinceContact ?? Infinity
    return db - da
  })

  return NextResponse.json({ contacts: result, total: result.length, asOf: today })
}
