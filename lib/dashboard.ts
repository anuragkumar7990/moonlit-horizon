import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfDay, endOfDay,
  isWithinInterval, subWeeks, format, parseISO, isPast,
} from 'date-fns'
import type { Call, Meeting, ZohoDeal, Target, FunnelStage, FunnelData, LeadCounts, WeeklyPoint } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOT_CONNECTED = new Set([
  'no answer', 'voicemail', 'busy', 'wrong number',
  'call dropped', 'disconnected', 'invalid number', 'no response', 'unanswered',
])

function isConnected(outcome: string): boolean {
  const o = outcome.toLowerCase().trim()
  return o !== '' && !NOT_CONNECTED.has(o)
}

function safeParseDate(d: string): Date | null {
  if (!d) return null
  try { return parseISO(d) } catch { return null }
}

function getTarget(targets: Target[], metricName: string): number | null {
  const currentMonth = format(new Date(), 'yyyy-MM')
  const t = targets.find(t => t.month === currentMonth && t.metricName === metricName)
  return t != null ? t.targetValue : null
}

function divOrNull(n: number | null, d: number): number | null {
  return n !== null ? Math.round(n / d) : null
}

// ── Exported types ────────────────────────────────────────────────────────────

export interface PeriodCallMetrics {
  dialled: number
  connected: number
  meetingsBooked: number
}

export interface PeriodMeetingMetrics {
  l1Booked: number
  l1Conducted: number
  l2Conducted: number
}

export interface CallsColumnData {
  weekly: PeriodCallMetrics
  monthly: PeriodCallMetrics
  targets: {
    weekly:  { dialled: number | null; connected: number | null; meetingsBooked: number | null }
    monthly: { dialled: number | null; connected: number | null; meetingsBooked: number | null }
  }
}

export interface MeetingsColumnData {
  weekly: PeriodMeetingMetrics
  monthly: PeriodMeetingMetrics
  targets: {
    weekly:  { l1Booked: number | null; l1Conducted: number | null; l2Conducted: number | null }
    monthly: { l1Booked: number | null; l1Conducted: number | null; l2Conducted: number | null }
  }
}

// ── Aggregation ───────────────────────────────────────────────────────────────

export function buildCallsData(
  calls: Call[],
  meetings: Meeting[],
  targets: Target[],
): CallsColumnData {
  const now = new Date()
  const weekStart  = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd    = endOfWeek(now,   { weekStartsOn: 1 })
  const monthStart = startOfMonth(now)
  const monthEnd   = endOfMonth(now)

  const inWeek  = (d: Date) => isWithinInterval(d, { start: weekStart,  end: weekEnd  })
  const inMonth = (d: Date) => isWithinInterval(d, { start: monthStart, end: monthEnd })

  let wD = 0, wC = 0, mD = 0, mC = 0

  for (const call of calls) {
    const d = safeParseDate(call.date)
    if (!d) continue
    if (inWeek(d))  { wD++; if (isConnected(call.outcome)) wC++ }
    if (inMonth(d)) { mD++; if (isConnected(call.outcome)) mC++ }
  }

  const wMtg = meetings.filter(m => {
    const d = safeParseDate(m.createdAt)
    return d && inWeek(d) && m.meetingType === 'L1'
  }).length
  const mMtg = meetings.filter(m => {
    const d = safeParseDate(m.createdAt)
    return d && inMonth(d) && m.meetingType === 'L1'
  }).length

  const tDial = getTarget(targets, 'Calls Dialled')
  const tConn = getTarget(targets, 'Calls Connected')
  const tMtg  = getTarget(targets, 'Meetings Booked')

  return {
    weekly:  { dialled: wD, connected: wC, meetingsBooked: wMtg },
    monthly: { dialled: mD, connected: mC, meetingsBooked: mMtg },
    targets: {
      weekly:  { dialled: divOrNull(tDial, 4), connected: divOrNull(tConn, 4), meetingsBooked: divOrNull(tMtg, 4) },
      monthly: { dialled: tDial,               connected: tConn,               meetingsBooked: tMtg },
    },
  }
}

export function buildMeetingsData(
  meetings: Meeting[],
  targets: Target[],
): MeetingsColumnData {
  const now = new Date()
  const weekStart  = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd    = endOfWeek(now,   { weekStartsOn: 1 })
  const monthStart = startOfMonth(now)
  const monthEnd   = endOfMonth(now)

  const inWeek  = (d: Date) => isWithinInterval(d, { start: weekStart,  end: weekEnd  })
  const inMonth = (d: Date) => isWithinInterval(d, { start: monthStart, end: monthEnd })
  const conducted = (m: Meeting) => { const d = safeParseDate(m.meetingTime); return d && isPast(d) }

  let wL1B = 0, wL1C = 0, wL2C = 0
  let mL1B = 0, mL1C = 0, mL2C = 0

  for (const m of meetings) {
    const created = safeParseDate(m.createdAt)
    if (!created) continue

    if (m.meetingType === 'L1') {
      if (inWeek(created))  { wL1B++; if (conducted(m)) wL1C++ }
      if (inMonth(created)) { mL1B++; if (conducted(m)) mL1C++ }
    } else {
      if (conducted(m)) {
        if (inWeek(created))  wL2C++
        if (inMonth(created)) mL2C++
      }
    }
  }

  const tL1B = getTarget(targets, 'L1 Meetings Booked')
  const tL1C = getTarget(targets, 'L1 Meetings Conducted')
  const tL2C = getTarget(targets, 'L2 Meetings Conducted')

  return {
    weekly:  { l1Booked: wL1B, l1Conducted: wL1C, l2Conducted: wL2C },
    monthly: { l1Booked: mL1B, l1Conducted: mL1C, l2Conducted: mL2C },
    targets: {
      weekly:  { l1Booked: divOrNull(tL1B, 4), l1Conducted: divOrNull(tL1C, 4), l2Conducted: divOrNull(tL2C, 4) },
      monthly: { l1Booked: tL1B,               l1Conducted: tL1C,               l2Conducted: tL2C },
    },
  }
}

const FUNNEL_ORDER = [
  'Discovery Call booked',
  'Discovery Call Conducted',
  'Outline Meeting Conducted',
  'Negotiation',
  'Payment Pending',
]

const s = (v: string) => v.toLowerCase().trim()

const HOT_STAGES  = new Set(['negotiation', 'payment pending'])
const WARM_STAGES = new Set(['discovery call conducted', 'outline meeting conducted'])
const COLD_STAGES = new Set(['discovery call booked'])

export function buildLeadCounts(deals: ZohoDeal[]): LeadCounts {
  let hot = 0, warm = 0, cold = 0
  for (const d of deals) {
    const stage = s(d.stage)
    if (HOT_STAGES.has(stage))  hot++
    else if (WARM_STAGES.has(stage)) warm++
    else if (COLD_STAGES.has(stage)) cold++
  }
  return { hot, warm, cold, total: hot + warm + cold }
}

export function buildFunnel(deals: ZohoDeal[]): FunnelData {
  const map = new Map<string, { count: number; amount: number }>()
  let wonCount = 0, wonAmt = 0, lostCount = 0, lostAmt = 0

  for (const d of deals) {
    const stage = d.stage || 'Unknown'
    const sl = s(stage)
    if (sl === 'won') { wonCount++; wonAmt += Number(d.amount || 0) }
    else if (sl === 'lost') { lostCount++; lostAmt += Number(d.amount || 0) }
    else {
      const cur = map.get(stage) ?? { count: 0, amount: 0 }
      map.set(stage, { count: cur.count + 1, amount: cur.amount + Number(d.amount || 0) })
    }
  }

  const stages: FunnelStage[] = []
  for (const stage of FUNNEL_ORDER) {
    const d = map.get(stage)
    if (d) stages.push({ stage, ...d })
  }
  map.forEach((d, stage) => {
    if (!FUNNEL_ORDER.includes(stage)) stages.push({ stage, ...d })
  })

  return {
    stages,
    won:  { count: wonCount, amount: wonAmt  },
    lost: { count: lostCount, amount: lostAmt },
  }
}

// ── Tanishq-specific ─────────────────────────────────────────────────────────

export interface TanishqPeriodMetrics {
  dialled:        { achieved: number; target: number | null }
  connected:      { achieved: number; target: number | null }
  meetingsBooked: { achieved: number; target: number | null }
}

export interface TanishqMetrics {
  daily:   TanishqPeriodMetrics
  weekly:  TanishqPeriodMetrics
  monthly: TanishqPeriodMetrics
}

export interface TodayMeeting {
  meetingId:   string
  accountName: string
  contactName: string
  meetingTime: string
  gMeetLink:   string
  meetingType: string
}

export interface FollowUpItem {
  account:      string
  contactName:  string
  contactPhone: string
  notes:        string
  outcome:      string
}

export function buildTanishqMetrics(
  calls: Call[],
  meetings: Meeting[],
  targets: Target[],
): TanishqMetrics {
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd   = endOfDay(now)
  const weekStart  = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd    = endOfWeek(now,   { weekStartsOn: 1 })
  const monthStart = startOfMonth(now)
  const monthEnd   = endOfMonth(now)

  const inToday = (d: Date) => isWithinInterval(d, { start: todayStart, end: todayEnd })
  const inWeek  = (d: Date) => isWithinInterval(d, { start: weekStart,  end: weekEnd  })
  const inMonth = (d: Date) => isWithinInterval(d, { start: monthStart, end: monthEnd })

  let dD = 0, dC = 0, wD = 0, wC = 0, mD = 0, mC = 0

  for (const call of calls) {
    const d = safeParseDate(call.date)
    if (!d) continue
    if (inToday(d)) { dD++; if (isConnected(call.outcome)) dC++ }
    if (inWeek(d))  { wD++; if (isConnected(call.outcome)) wC++ }
    if (inMonth(d)) { mD++; if (isConnected(call.outcome)) mC++ }
  }

  const dMtg = meetings.filter(m => { const d = safeParseDate(m.createdAt); return d && inToday(d) && m.meetingType === 'L1' }).length
  const wMtg = meetings.filter(m => { const d = safeParseDate(m.createdAt); return d && inWeek(d)  && m.meetingType === 'L1' }).length
  const mMtg = meetings.filter(m => { const d = safeParseDate(m.createdAt); return d && inMonth(d) && m.meetingType === 'L1' }).length

  const tDial = getTarget(targets, 'Calls Dialled')
  const tConn = getTarget(targets, 'Calls Connected')
  const tMtg  = getTarget(targets, 'Meetings Booked')

  return {
    daily: {
      dialled:        { achieved: dD,   target: divOrNull(tDial, 22) },
      connected:      { achieved: dC,   target: divOrNull(tConn, 22) },
      meetingsBooked: { achieved: dMtg, target: divOrNull(tMtg,  22) },
    },
    weekly: {
      dialled:        { achieved: wD,   target: divOrNull(tDial, 4) },
      connected:      { achieved: wC,   target: divOrNull(tConn, 4) },
      meetingsBooked: { achieved: wMtg, target: divOrNull(tMtg,  4) },
    },
    monthly: {
      dialled:        { achieved: mD,   target: tDial },
      connected:      { achieved: mC,   target: tConn },
      meetingsBooked: { achieved: mMtg, target: tMtg  },
    },
  }
}

export function buildTodaysMeetings(meetings: Meeting[]): TodayMeeting[] {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  return meetings
    .filter(m => m.meetingTime.startsWith(todayStr))
    .sort((a, b) => a.meetingTime.localeCompare(b.meetingTime))
    .map(m => ({
      meetingId:   m.meetingId,
      accountName: m.accountName,
      contactName: m.contactName,
      meetingTime: m.meetingTime,
      gMeetLink:   m.gMeetLink,
      meetingType: m.meetingType,
    }))
}

export function buildFollowUps(calls: Call[]): FollowUpItem[] {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  return calls
    .filter(c => c.followUpDate?.startsWith(todayStr))
    .map(c => ({
      account:      c.account,
      contactName:  c.contactName,
      contactPhone: c.contactPhone,
      notes:        c.notes,
      outcome:      c.outcome,
    }))
}

export function buildWeeklyTrend(calls: Call[], meetings: Meeting[]): WeeklyPoint[] {
  const now = new Date()
  return Array.from({ length: 8 }, (_, i) => {
    const ref    = subWeeks(now, 7 - i)
    const wStart = startOfWeek(ref, { weekStartsOn: 1 })
    const wEnd   = endOfWeek(ref,   { weekStartsOn: 1 })
    const inW    = (d: Date) => isWithinInterval(d, { start: wStart, end: wEnd })

    let dialled = 0, connected = 0
    for (const c of calls) {
      const d = safeParseDate(c.date)
      if (d && inW(d)) {
        dialled++
        if (isConnected(c.outcome)) connected++
      }
    }

    let l1Booked = 0, l1Conducted = 0
    for (const m of meetings) {
      const d = safeParseDate(m.createdAt)
      if (d && inW(d) && m.meetingType === 'L1') {
        l1Booked++
        const mt = safeParseDate(m.meetingTime)
        if (mt && isPast(mt)) l1Conducted++
      }
    }

    return {
      week: format(wStart, 'MMM d'),
      dialled,
      connected,
      l1Booked,
      l1Conducted,
      connectionRate: dialled > 0 ? Math.round((connected / dialled) * 100) : 0,
      bookingRate:    connected > 0 ? Math.round((l1Booked / connected) * 100) : 0,
    }
  })
}
