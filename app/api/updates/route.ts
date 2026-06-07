import { NextResponse } from 'next/server'
import { getCalls, getMeetings, getNotes, getPayments } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export interface UpdateEvent {
  id:        string
  type:      'call' | 'meeting' | 'note' | 'payment' | 'intel'
  title:     string
  subtitle:  string
  timestamp: string
  meta?:     string
}

export async function GET() {
  try {
    const [callsRes, meetingsRes, notesRes, paymentsRes] = await Promise.allSettled([
      getCalls(),
      getMeetings(),
      getNotes(),
      getPayments(),
    ])

    const calls    = callsRes.status    === 'fulfilled' ? callsRes.value    : []
    const meetings = meetingsRes.status === 'fulfilled' ? meetingsRes.value : []
    const notes    = notesRes.status    === 'fulfilled' ? notesRes.value    : []
    const payments = paymentsRes.status === 'fulfilled' ? paymentsRes.value : []

    const events: UpdateEvent[] = []

    // Last 60 calls
    for (const c of calls.slice(-60)) {
      if (!c.date) continue
      events.push({
        id:        `call-${c.zohoCallId || c.date + c.account}`,
        type:      'call',
        title:     c.account || 'Unknown',
        subtitle:  c.outcome || 'Call logged',
        timestamp: `${c.date}${c.time ? ' ' + c.time : ''}`,
        meta:      c.sdr ? `by ${c.sdr}` : undefined,
      })
    }

    // All meetings — show recent Conducted ones
    for (const m of meetings) {
      if (!m.meetingTime) continue
      events.push({
        id:        `meeting-${m.meetingId}`,
        type:      'meeting',
        title:     m.accountName || 'Unknown',
        subtitle:  `${m.meetingType} meeting${m.status === 'Conducted' ? ' · Conducted' : ''}`,
        timestamp: m.meetingTime,
        meta:      m.contactName || undefined,
      })
    }

    // Notes
    for (const n of notes) {
      if (!n.createdAt) continue
      events.push({
        id:        `note-${n.meetingId}`,
        type:      'note',
        title:     n.accountName || 'Unknown',
        subtitle:  n.summary ? n.summary.slice(0, 80) + (n.summary.length > 80 ? '…' : '') : 'Notes added',
        timestamp: n.createdAt,
        meta:      n.assignedTo || undefined,
      })
    }

    // Payments
    for (const p of payments) {
      if (!p.date) continue
      events.push({
        id:        `payment-${p.date}-${p.account}`,
        type:      'payment',
        title:     p.account,
        subtitle:  `${p.status} · ₹${p.amount.toLocaleString('en-IN')}`,
        timestamp: p.date,
        meta:      p.deal || undefined,
      })
    }

    // Sort newest-first, cap at 200
    events.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    const recent = events.slice(0, 200)

    return NextResponse.json(
      { events: recent },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=30' } }
    )
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
