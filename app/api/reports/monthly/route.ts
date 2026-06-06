import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React, { type ReactElement } from 'react'
import { MonthlyReport } from '@/components/pdf/MonthlyReport'
import { getCalls, getMeetings, getTargets } from '@/lib/sheets'
import { getDeals, getZohoCalls } from '@/lib/zoho'
import { buildCallsData, buildMeetingsData, buildFunnel, buildLeadCounts, mergeCallSources } from '@/lib/dashboard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function istNow(): Date {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000)
}

export async function GET() {
  try {
    const [callsRes, meetingsRes, dealsRes, targetsRes, zohoCallsRes] = await Promise.allSettled([
      getCalls(), getMeetings(), getDeals(), getTargets(), getZohoCalls(),
    ])

    const calls     = callsRes.status     === 'fulfilled' ? callsRes.value     : []
    const meetings  = meetingsRes.status  === 'fulfilled' ? meetingsRes.value  : []
    const deals     = dealsRes.status     === 'fulfilled' ? dealsRes.value     : []
    const targets   = targetsRes.status   === 'fulfilled' ? targetsRes.value   : []
    const zohoCalls = zohoCallsRes.status === 'fulfilled' ? zohoCallsRes.value : []

    const allCalls     = mergeCallSources(calls, zohoCalls)
    const callsData    = buildCallsData(allCalls, meetings, targets)
    const meetingsData = buildMeetingsData(meetings, targets)
    const funnel       = buildFunnel(deals)
    const leads        = buildLeadCounts(deals)

    const m  = callsData.monthly
    const mm = meetingsData.monthly
    const rate = m.dialled > 0 ? ((m.connected / m.dialled) * 100).toFixed(0) : '0'

    const pipelineAmount = funnel.stages.reduce((s, st) => s + st.amount, 0)

    // Build targets vs actuals table
    const ist = istNow()
    const currentMonth = `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}`
    const monthTargets = targets.filter(t => t.month === currentMonth)
    const targetRows = [
      { metric: 'Calls Dialled',        actual: m.dialled,              target: monthTargets.find(t => t.metricName === 'Calls Dialled')?.targetValue ?? null },
      { metric: 'Calls Connected',       actual: m.connected,            target: monthTargets.find(t => t.metricName === 'Calls Connected')?.targetValue ?? null },
      { metric: 'Meetings Booked',       actual: m.meetingsBooked,       target: monthTargets.find(t => t.metricName === 'Meetings Booked')?.targetValue ?? null },
      { metric: 'L1 Meetings Conducted', actual: mm.l1Conducted,         target: monthTargets.find(t => t.metricName === 'L1 Meetings Conducted')?.targetValue ?? null },
      { metric: 'L2 Meetings Conducted', actual: mm.l2Conducted,         target: monthTargets.find(t => t.metricName === 'L2 Meetings Conducted')?.targetValue ?? null },
    ].filter(r => r.actual > 0 || r.target)

    const wonDeals = deals
      .filter(d => d.stage === 'Won')
      .map(d => ({ name: d.accountName || d.dealName || '—', amount: Number(d.amount) || 0 }))

    const monthLabel = ist.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'long', year: 'numeric' })
    const generatedAt = `${ist.toISOString().slice(0, 10)} ${ist.toISOString().slice(11, 16)} IST`

    const buffer = await renderToBuffer(
      React.createElement(MonthlyReport, {
        data: {
          month: monthLabel,
          generatedAt,
          calls: { dialled: m.dialled, connected: m.connected, rate, meetingsBooked: m.meetingsBooked },
          meetings: { l1Booked: mm.l1Booked, l1Conducted: mm.l1Conducted, l2Conducted: mm.l2Conducted },
          leads: { hot: leads.hot, warm: leads.warm, cold: leads.cold, total: leads.total },
          targets: targetRows,
          wonDeals,
          pipelineAmount,
        }
      }) as ReactElement
    )

    const filename = `ttt-monthly-${currentMonth}.pdf`
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[reports/monthly]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
