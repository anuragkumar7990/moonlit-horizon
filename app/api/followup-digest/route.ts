import { NextRequest, NextResponse } from 'next/server'
import { getContacts, getLeads } from '@/lib/zoho'
import { getContactIntelligence, getAccountIntelligence, getManualTouchpoints, type ManualTouchpoint } from '@/lib/sheets'
import { postToDiscordChannel } from '@/lib/discord'

export const dynamic = 'force-dynamic'

const SECRET = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'

// Called by Vercel Cron or manually to post a follow-up digest to Discord
// GET /api/followup-digest?secret=thetesttribe
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [contacts, leads, ciRows, aiRows, touchpoints] = await Promise.all([
    getContacts().catch(() => []),
    getLeads().catch(() => []),
    getContactIntelligence().catch(() => []),
    getAccountIntelligence().catch(() => []),
    getManualTouchpoints().catch(() => []),
  ])

  const ciMap = new Map(ciRows.filter(r => r.email).map(r => [r.email.toLowerCase(), r]))
  const aiMap = new Map(aiRows.map(r => [r.account.toLowerCase(), r]))
  const mtMap = new Map<string, ManualTouchpoint[]>()
  for (const tp of touchpoints) {
    const key = tp.email.toLowerCase()
    if (!mtMap.has(key)) mtMap.set(key, [])
    mtMap.get(key)!.push(tp)
  }
  mtMap.forEach(arr => arr.sort((a, b) => b.date.localeCompare(a.date)))

  const seenEmails = new Set<string>()
  const people: { name: string; accountName: string; email: string }[] = []
  for (const c of contacts) {
    if (c.email) seenEmails.add(c.email.toLowerCase())
    people.push({ name: `${c.firstName} ${c.lastName}`.trim() || c.email, accountName: c.accountName, email: c.email })
  }
  for (const l of leads) {
    if (l.email && seenEmails.has(l.email.toLowerCase())) continue
    people.push({ name: `${l.firstName} ${l.lastName}`.trim() || l.email, accountName: l.company, email: l.email })
  }

  const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const overdue: { name: string; account: string; days: number; lastType: string }[] = []

  for (const p of people) {
    const emailKey = p.email.toLowerCase()
    const ci = emailKey ? ciMap.get(emailKey) : undefined
    const ai = p.accountName ? aiMap.get(p.accountName.toLowerCase()) : undefined
    const latestManual = emailKey ? (mtMap.get(emailKey)?.[0] ?? null) : null

    const dates = [ci?.lastCallDate, ai?.lastContactDate, latestManual?.date].filter(Boolean) as string[]
    const lastDate = dates.length ? dates.sort().pop()! : ''
    if (!lastDate) continue

    const days = Math.floor((new Date(today).getTime() - new Date(lastDate).getTime()) / 86400000)
    if (days < 7) continue

    let lastType = 'Call'
    if (latestManual?.date === lastDate) lastType = latestManual.type
    else if (ai?.circlebakIntelligence?.includes(lastDate)) lastType = 'Google Meet'
    else if (ai?.emailIntelligence?.includes(lastDate)) lastType = 'Email'

    overdue.push({ name: p.name, account: p.accountName, days, lastType })
  }

  overdue.sort((a, b) => b.days - a.days)

  if (overdue.length === 0) {
    await postToDiscordChannel('follow-ups', `**Follow-Up Digest — ${today}**\nAll contacts reached within the last 7 days. `)
    return NextResponse.json({ ok: true, sent: 0 })
  }

  const top = overdue.slice(0, 20)
  const lines = top.map(c => `• **${c.name}** (${c.account || '—'}) — last: ${c.lastType}, **${c.days}d ago**`)
  const more = overdue.length > 20 ? `\n_…and ${overdue.length - 20} more_` : ''

  const msg = `**Follow-Up Digest — ${today}** | ${overdue.length} contacts need attention\n\n${lines.join('\n')}${more}`
  await postToDiscordChannel('follow-ups', msg)

  return NextResponse.json({ ok: true, sent: overdue.length })
}
