import { NextRequest, NextResponse } from 'next/server'
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns'
import { getTargets, getMeetings, getCalls, upsertTarget } from '@/lib/sheets'
import { getZohoCalls, ZOHO_CONNECTED_OUTCOMES } from '@/lib/zoho'

export const dynamic = 'force-dynamic'

const MONTHLY_METRICS = [
  'Calls Dialled',
  'Calls Connected',
  'Meetings Booked',
  'L1 Meetings Conducted',
  'L2 Meetings Conducted',
]

export async function GET() {
  const now       = new Date()
  const monthKey  = format(now, 'yyyy-MM')
  const monthStart = startOfMonth(now)
  const monthEnd   = endOfMonth(now)

  const inMonth = (dateStr: string) => {
    try { return isWithinInterval(parseISO(dateStr), { start: monthStart, end: monthEnd }) }
    catch { return false }
  }

  const [targetsArr, meetings, calls, zohoCalls] = await Promise.all([
    getTargets(),
    getMeetings(),
    getCalls(),
    getZohoCalls(),
  ])

  const monthTargets = targetsArr.filter(t => t.month === monthKey)
  const getTarget = (name: string) => monthTargets.find(t => t.metricName === name)?.targetValue ?? 0

  // Compute actuals — same dedup logic as weekly summary
  const monthSheetCalls = calls.filter(c => inMonth(c.date))
  const monthZohoCalls  = zohoCalls.filter(c => inMonth(c.date))

  const seenKeys = new Set<string>()
  const allCalls: { outcome: string }[] = []
  for (const c of monthZohoCalls) {
    const key = `${c.date}:${c.accountName.toLowerCase()}`
    seenKeys.add(key)
    allCalls.push({ outcome: c.outcome })
  }
  for (const c of monthSheetCalls) {
    const key = `${c.date}:${c.account.toLowerCase()}`
    if (!seenKeys.has(key)) allCalls.push({ outcome: c.outcome ?? '' })
  }

  const dialled        = allCalls.length
  const connected      = allCalls.filter(c => ZOHO_CONNECTED_OUTCOMES.has(c.outcome)).length
  const meetingsBooked = allCalls.filter(c =>
    c.outcome === 'Meeting Scheduled' || c.outcome === 'meeting booked'
  ).length

  const monthMeetings = meetings.filter(m => m.meetingTime && inMonth(m.meetingTime))
  const l1Conducted   = monthMeetings.filter(m => m.meetingType === 'L1').length
  const l2Conducted   = monthMeetings.filter(m => m.meetingType === 'L2+').length

  const actuals: Record<string, number> = {
    'Calls Dialled':         dialled,
    'Calls Connected':       connected,
    'Meetings Booked':       meetingsBooked,
    'L1 Meetings Conducted': l1Conducted,
    'L2 Meetings Conducted': l2Conducted,
  }

  const result = MONTHLY_METRICS.map(m => ({
    metric:  m,
    target:  getTarget(m),
    actual:  actuals[m] ?? 0,
    pct:     getTarget(m) > 0 ? Math.round(((actuals[m] ?? 0) / getTarget(m)) * 100) : null,
  }))

  return NextResponse.json({ month: monthKey, targets: result })
}

export async function POST(req: NextRequest) {
  const { metricName, targetValue } = await req.json()
  if (!metricName || targetValue == null) {
    return NextResponse.json({ error: 'metricName and targetValue are required' }, { status: 400 })
  }
  if (!MONTHLY_METRICS.includes(metricName)) {
    return NextResponse.json({ error: `Unknown metric. Valid: ${MONTHLY_METRICS.join(', ')}` }, { status: 400 })
  }

  const monthKey = format(new Date(), 'yyyy-MM')
  await upsertTarget(monthKey, metricName, Number(targetValue))
  return NextResponse.json({ ok: true, month: monthKey, metricName, targetValue: Number(targetValue) })
}
