import { NextResponse } from 'next/server'
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
  const [ciRows, aiRows, touchpoints] = await Promise.all([
    getContactIntelligence().catch(() => []),
    getAccountIntelligence().catch(() => []),
    getManualTouchpoints().catch(() => []),
  ])

  const aiMap = new Map(aiRows.map(r => [r.account.toLowerCase(), r]))

  const mtMap = new Map<string, ManualTouchpoint[]>()
  for (const tp of touchpoints) {
    const key = tp.email.toLowerCase()
    if (!mtMap.has(key)) mtMap.set(key, [])
    mtMap.get(key)!.push(tp)
  }
  mtMap.forEach(arr => arr.sort((a, b) => b.date.localeCompare(a.date)))

  const today = todayIST()

  const result: TrackerContact[] = ciRows.map(ci => {
    const emailKey   = ci.email.toLowerCase()
    const accountKey = ci.company.toLowerCase()

    const ai           = accountKey ? aiMap.get(accountKey) : undefined
    const latestManual = emailKey ? (mtMap.get(emailKey)?.[0] ?? null) : null

    const callDate    = ci.lastCallDate ?? ''
    const accountDate = ai?.lastContactDate ?? ''
    const manualDate  = latestManual?.date ?? ''

    const lastContactDate = maxDate(callDate, accountDate, manualDate)

    let lastTouchpointType: TrackerContact['lastTouchpointType'] = null

    if (lastContactDate) {
      if (manualDate && manualDate === lastContactDate) {
        lastTouchpointType = latestManual!.type
      } else if (accountDate && accountDate === lastContactDate && ai) {
        if (ai.circlebakIntelligence?.includes(accountDate)) lastTouchpointType = 'Google Meet'
        else if (ai.emailIntelligence?.includes(accountDate)) lastTouchpointType = 'Email'
        else lastTouchpointType = 'Call'
      } else if (callDate) {
        lastTouchpointType = 'Call'
      }
    }

    const daysSinceContact = lastContactDate ? daysBetween(lastContactDate) : null

    return {
      name:        ci.name,
      accountName: ci.company,
      phone:       ci.phone,
      email:       ci.email,
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
