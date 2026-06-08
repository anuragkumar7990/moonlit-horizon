import { NextRequest, NextResponse } from 'next/server'
import { getContactIntelligence, getAccountIntelligence, getManualTouchpoints, type ManualTouchpoint } from '@/lib/sheets'
import { postToDiscordChannel } from '@/lib/discord'

export const dynamic = 'force-dynamic'

const SECRET = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const overdue: { name: string; account: string; days: number; lastType: string }[] = []

  for (const ci of ciRows) {
    const emailKey = ci.email.toLowerCase()
    const ai = ci.company ? aiMap.get(ci.company.toLowerCase()) : undefined
    const latestManual = emailKey ? (mtMap.get(emailKey)?.[0] ?? null) : null

    const dates = [ci.lastCallDate, ai?.lastContactDate, latestManual?.date].filter(Boolean) as string[]
    const lastDate = dates.length ? dates.sort().pop()! : ''
    if (!lastDate) continue

    const days = Math.floor((new Date(today).getTime() - new Date(lastDate).getTime()) / 86400000)
    if (days < 7) continue

    let lastType = 'Call'
    if (latestManual?.date === lastDate) lastType = latestManual.type
    else if (ai?.circlebakIntelligence?.includes(lastDate)) lastType = 'Google Meet'
    else if (ai?.emailIntelligence?.includes(lastDate)) lastType = 'Email'

    overdue.push({ name: ci.name, account: ci.company, days, lastType })
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
