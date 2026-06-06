import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React, { type ReactElement } from 'react'
import { WeeklyReport } from '@/components/pdf/WeeklyReport'
import { getCalls, getMeetings, getTargets, getLatestSummary } from '@/lib/sheets'
import { getDeals, getZohoCalls } from '@/lib/zoho'
import { buildCallsData, buildMeetingsData, buildFunnel, buildLeadCounts, mergeCallSources } from '@/lib/dashboard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function istNow(): Date {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000)
}

function weekOfLabel(): string {
  const now = istNow()
  const day = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((day + 6) % 7))
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return `${fmt(mon)} – ${fmt(sun)}, ${sun.getFullYear()}`
}

export async function GET() {
  try {
    const [callsRes, meetingsRes, dealsRes, targetsRes, zohoCallsRes, summaryRes] = await Promise.allSettled([
      getCalls(), getMeetings(), getDeals(), getTargets(), getZohoCalls(), getLatestSummary(),
    ])

    const calls     = callsRes.status     === 'fulfilled' ? callsRes.value     : []
    const meetings  = meetingsRes.status  === 'fulfilled' ? meetingsRes.value  : []
    const deals     = dealsRes.status     === 'fulfilled' ? dealsRes.value     : []
    const targets   = targetsRes.status   === 'fulfilled' ? targetsRes.value   : []
    const zohoCalls = zohoCallsRes.status === 'fulfilled' ? zohoCallsRes.value : []
    const summary   = summaryRes.status   === 'fulfilled' ? summaryRes.value   : null

    const allCalls     = mergeCallSources(calls, zohoCalls)
    const callsData    = buildCallsData(allCalls, meetings, targets)
    const meetingsData = buildMeetingsData(meetings, targets)
    const funnel       = buildFunnel(deals)
    const leads        = buildLeadCounts(deals)

    const w = callsData.weekly
    const mw = meetingsData.weekly
    const rate = w.dialled > 0 ? ((w.connected / w.dialled) * 100).toFixed(0) : '0'

    const hotDeals = deals
      .filter(d => ['Discovery Call Conducted', 'Outline Meeting Conducted', 'Proposal Sent', 'Negotiation', 'Payment Pending'].includes(d.stage))
      .map(d => ({ name: d.accountName || d.dealName || '—', stage: d.stage, amount: Number(d.amount) || 0 }))
      .slice(0, 6)

    const ist = istNow()
    const generatedAt = `${ist.toISOString().slice(0, 10)} ${ist.toISOString().slice(11, 16)} IST`

    const buffer = await renderToBuffer(
      React.createElement(WeeklyReport, {
        data: {
          weekOf: weekOfLabel(),
          generatedAt,
          calls: { dialled: w.dialled, connected: w.connected, rate, meetingsBooked: w.meetingsBooked },
          meetings: { l1Booked: mw.l1Booked, l1Conducted: mw.l1Conducted, l2Conducted: mw.l2Conducted },
          leads: { hot: leads.hot, warm: leads.warm, cold: leads.cold, total: leads.total },
          hotDeals,
          summary: summary?.summary ?? '',
        }
      }) as ReactElement
    )

    const filename = `ttt-weekly-${ist.toISOString().slice(0, 10)}.pdf`
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[reports/weekly]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
