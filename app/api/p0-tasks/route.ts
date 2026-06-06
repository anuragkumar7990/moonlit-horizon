import { NextResponse } from 'next/server'
import { format, parseISO, differenceInHours, differenceInDays, isPast } from 'date-fns'
import { getMeetings, getNotes, getCalls, getTasks, appendTaskRows } from '@/lib/sheets'
import { getDeals } from '@/lib/zoho'

export const dynamic = 'force-dynamic'

const CLOSED_STAGES = new Set(['won', 'lost'])

interface P0Task {
  category: 'no-notes' | 'overdue-closing' | 'overdue-callback'
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

  // Keys already written as P0 tasks today — used to deduplicate
  const todayP0Keys = new Set(
    existing
      .filter(t => t.date === today && t.type === 'P0')
      .map(t => t.linkedDeal)
  )

  const newTasks: P0Task[] = []

  // 1. Meetings 24–72h old with no notes entry
  const notedIds = new Set(notes.map(n => n.meetingId))
  for (const m of meetings) {
    if (!m.meetingTime) continue
    try {
      const mt = parseISO(m.meetingTime)
      const hoursAgo = differenceInHours(new Date(), mt)
      if (hoursAgo < 24 || hoursAgo > 72) continue
      if (notedIds.has(m.meetingId)) continue
      const key = `meeting:${m.meetingId}`
      if (todayP0Keys.has(key)) continue
      newTasks.push({
        category: 'no-notes',
        task: `Add follow-up notes for ${m.accountName} (${m.meetingType})`,
        detail: `${m.contactName} · met ${format(mt, 'dd MMM, HH:mm')} (${hoursAgo}h ago)`,
        linkedDeal: key,
        assignedTo: 'Tanishq',
      })
    } catch { /* skip unparseable date */ }
  }

  // 2. Active deals with closing date in the past
  for (const d of deals) {
    if (!d.closingDate) continue
    const stage = d.stage.toLowerCase().trim()
    if (CLOSED_STAGES.has(stage)) continue
    try {
      const closing = parseISO(d.closingDate)
      const daysOverdue = differenceInDays(new Date(), closing)
      if (daysOverdue < 1) continue
      const key = `deal:${d.id}:overdue`
      if (todayP0Keys.has(key)) continue
      newTasks.push({
        category: 'overdue-closing',
        task: `Closing date overdue: ${d.accountName} — ${d.stage}`,
        detail: `Was due ${format(closing, 'dd MMM')} · ${daysOverdue}d overdue`,
        linkedDeal: key,
        assignedTo: 'Anurag',
      })
    } catch { /* skip */ }
  }

  // 3. Calls logged as "callback later" with a past follow-up date
  for (const c of calls) {
    if (c.outcome !== 'callback later' || !c.followUpDate) continue
    try {
      const due = parseISO(c.followUpDate)
      if (!isPast(due)) continue
      const key = `callback:${c.account}:${c.contactName}`
      if (todayP0Keys.has(key)) continue
      const daysOverdue = differenceInDays(new Date(), due)
      newTasks.push({
        category: 'overdue-callback',
        task: `Overdue callback: ${c.contactName} (${c.account})`,
        detail: `Due ${format(due, 'dd MMM')}${daysOverdue > 0 ? ` · ${daysOverdue}d overdue` : ''}`,
        linkedDeal: key,
        assignedTo: 'Tanishq',
      })
    } catch { /* skip */ }
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
