import { NextResponse } from 'next/server'
import { format, parseISO, differenceInHours, differenceInDays, isPast } from 'date-fns'
import { getMeetings, getNotes, getCalls, getTasks, appendTaskRows } from '@/lib/sheets'
import { getDeals } from '@/lib/zoho'

export const dynamic = 'force-dynamic'

const CLOSED_STAGES = new Set(['won', 'lost'])

// For each active stage: how many days without a logged call before it becomes P0,
// and how often the task should recur (so it doesn't spam daily).
const STAGE_RULES = [
  { match: 'payment pending',           taskPrefix: 'Chase payment',     staleDays: 2, repeatDays: 2, assignedTo: 'Anurag'   },
  { match: 'negotiation',               taskPrefix: 'Follow up on deal', staleDays: 3, repeatDays: 3, assignedTo: 'Anurag'   },
  { match: 'outline meeting conducted', taskPrefix: 'Send proposal',     staleDays: 5, repeatDays: 5, assignedTo: 'Anurag'   },
  { match: 'discovery call conducted',  taskPrefix: 'Book L2 meeting',   staleDays: 5, repeatDays: 5, assignedTo: 'Tanishq'  },
] as const

interface P0Task {
  category: 'no-notes' | 'overdue-closing' | 'overdue-callback' | 'stale-deal'
  task: string
  detail: string
  linkedDeal: string
  assignedTo: string
}

export async function GET() {
  const [meetingsRes, notesRes, dealsRes, callsRes, tasksRes] = await Promise.allSettled([
    getMeetings(), getNotes(), getDeals(), getCalls(), getTasks(),
  ])

  const meetings = meetingsRes.status === 'fulfilled' ? meetingsRes.value : []
  const notes    = notesRes.status    === 'fulfilled' ? notesRes.value    : []
  const deals    = dealsRes.status    === 'fulfilled' ? dealsRes.value    : []
  const calls    = callsRes.status    === 'fulfilled' ? callsRes.value    : []
  const existing = tasksRes.status    === 'fulfilled' ? tasksRes.value    : []

  const today = format(new Date(), 'yyyy-MM-dd')

  // For each linkedDeal key, track the most recent date a P0 task was written.
  // Used to enforce per-task recurrence windows (not just "once today").
  const lastP0Date = new Map<string, string>()
  for (const t of existing) {
    if (t.type !== 'P0') continue
    const prev = lastP0Date.get(t.linkedDeal)
    if (!prev || t.date > prev) lastP0Date.set(t.linkedDeal, t.date)
  }

  function recentlyFlagged(key: string, withinDays: number): boolean {
    const last = lastP0Date.get(key)
    if (!last) return false
    return differenceInDays(new Date(), parseISO(last)) < withinDays
  }

  // Last call date per account (case-insensitive), for stale-deal checks
  const lastCallByAccount = new Map<string, string>()
  for (const c of calls) {
    if (!c.date || !c.account) continue
    const key = c.account.toLowerCase()
    const prev = lastCallByAccount.get(key)
    if (!prev || c.date > prev) lastCallByAccount.set(key, c.date)
  }

  const newTasks: P0Task[] = []

  // ── 1. Meetings 24–72h old with no notes entry ───────────────────
  const notedIds = new Set(notes.map(n => n.meetingId))
  for (const m of meetings) {
    if (!m.meetingTime) continue
    try {
      const mt = parseISO(m.meetingTime)
      const hoursAgo = differenceInHours(new Date(), mt)
      if (hoursAgo < 24 || hoursAgo > 72) continue
      if (notedIds.has(m.meetingId)) continue
      const key = `meeting:${m.meetingId}`
      if (recentlyFlagged(key, 1)) continue
      newTasks.push({
        category: 'no-notes',
        task:     `Add follow-up notes for ${m.accountName} (${m.meetingType})`,
        detail:   `${m.contactName} · met ${format(mt, 'dd MMM, HH:mm')} (${hoursAgo}h ago)`,
        linkedDeal: key,
        assignedTo: 'Tanishq',
      })
    } catch { /* skip */ }
  }

  // ── 2. Active deals with closing date in the past ────────────────
  for (const d of deals) {
    if (!d.closingDate) continue
    const stage = d.stage.toLowerCase().trim()
    if (CLOSED_STAGES.has(stage)) continue
    try {
      const closing = parseISO(d.closingDate)
      const daysOverdue = differenceInDays(new Date(), closing)
      if (daysOverdue < 1) continue
      const key = `deal:${d.id}:overdue`
      if (recentlyFlagged(key, 1)) continue
      newTasks.push({
        category: 'overdue-closing',
        task:     `Closing date overdue: ${d.accountName} — ${d.stage}`,
        detail:   `Was due ${format(closing, 'dd MMM')} · ${daysOverdue}d overdue`,
        linkedDeal: key,
        assignedTo: 'Anurag',
      })
    } catch { /* skip */ }
  }

  // ── 3. Overdue callbacks from calls log ──────────────────────────
  for (const c of calls) {
    if (c.outcome !== 'callback later' || !c.followUpDate) continue
    try {
      const due = parseISO(c.followUpDate)
      if (!isPast(due)) continue
      const key = `callback:${c.account}:${c.contactName}`
      if (recentlyFlagged(key, 1)) continue
      const daysOverdue = differenceInDays(new Date(), due)
      newTasks.push({
        category: 'overdue-callback',
        task:     `Overdue callback: ${c.contactName} (${c.account})`,
        detail:   `Due ${format(due, 'dd MMM')}${daysOverdue > 0 ? ` · ${daysOverdue}d overdue` : ''}`,
        linkedDeal: key,
        assignedTo: 'Tanishq',
      })
    } catch { /* skip */ }
  }

  // ── 4. Stage-based stale deal checks ────────────────────────────
  for (const d of deals) {
    const stage = d.stage.toLowerCase().trim()
    if (CLOSED_STAGES.has(stage)) continue

    const rule = STAGE_RULES.find(r => r.match === stage)
    if (!rule) continue

    const key = `deal:${d.id}:stale`
    if (recentlyFlagged(key, rule.repeatDays)) continue

    // Check last call for this account
    const lastCall =
      lastCallByAccount.get(d.accountName.toLowerCase()) ??
      lastCallByAccount.get(d.contactName.toLowerCase()) ??
      lastCallByAccount.get(d.dealName.toLowerCase())
    const daysSinceCall = lastCall
      ? differenceInDays(new Date(), parseISO(lastCall))
      : Infinity

    if (daysSinceCall < rule.staleDays) continue

    const displayName = d.accountName || d.contactName || d.dealName || 'Unknown'

    const staleSuffix = lastCall
      ? `last call ${differenceInDays(new Date(), parseISO(lastCall))}d ago`
      : 'no call logged yet'

    const closingInfo = d.closingDate
      ? (() => {
          try {
            const c = parseISO(d.closingDate)
            const diff = differenceInDays(c, new Date())
            if (diff < 0) return ` · closing ${Math.abs(diff)}d overdue`
            if (diff <= 7) return ` · closing in ${diff}d`
            return ''
          } catch { return '' }
        })()
      : ''

    newTasks.push({
      category:   'stale-deal',
      task:       `${rule.taskPrefix}: ${displayName}`,
      detail:     `${d.stage} · ${staleSuffix}${closingInfo}`,
      linkedDeal: key,
      assignedTo: rule.assignedTo,
    })
  }

  // Write new tasks to sheet
  if (newTasks.length > 0) {
    await appendTaskRows(newTasks.map(t => ({
      date:       today,
      task:       t.task,
      type:       'P0' as const,
      assignedTo: t.assignedTo,
      linkedDeal: t.linkedDeal,
      status:     'Open',
    })))
  }

  return NextResponse.json({
    date:     today,
    newCount: newTasks.length,
    tasks:    newTasks,
  })
}
