'use client'
import { useState } from 'react'
import MetricCard from './MetricCard'
import MetricsGraph from './MetricsGraph'
import FunnelColumn from './FunnelColumn'
import type { LeadCounts, FunnelData, WeeklyPoint } from '@/lib/types'
import type { CallsColumnData, MeetingsColumnData } from '@/lib/dashboard'

type Period = 'weekly' | 'monthly'

interface Props {
  callsData:      CallsColumnData
  meetingsData:   MeetingsColumnData
  leads:          LeadCounts
  funnel:         FunnelData
  weeklyTrend:    WeeklyPoint[]
  weeklySummary?: string | null
}

function Divider() {
  return <div className="border-t border-mh-border my-2" />
}

function ColHeader({ children }: { children: string }) {
  return (
    <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-4">
      {children}
    </p>
  )
}

export default function MasterTrackerGrid({ callsData, meetingsData, leads, funnel, weeklyTrend, weeklySummary }: Props) {
  const [period, setPeriod] = useState<Period>('weekly')

  const calls        = callsData[period]
  const callTargets  = callsData.targets[period]
  const mtgs         = meetingsData[period]
  const mtgTargets   = meetingsData.targets[period]

  return (
    <div>
      {/* Row 1: period toggle */}
      <div className="flex items-center justify-end mb-6">
        <div className="flex items-center gap-1 bg-mh-surface border border-mh-border rounded-full p-1">
          {(['weekly', 'monthly'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-4 py-1.5 rounded-full font-medium capitalize transition-colors
                ${period === p
                  ? 'bg-mh-vermillion text-white'
                  : 'text-mh-muted hover:text-mh-text'
                }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* 5-column master grid */}
      <div className="grid grid-cols-[180px_180px_160px_200px_1fr] gap-4 items-start">

        {/* I — Calls */}
        <div className="card">
          <ColHeader>Calls</ColHeader>
          <MetricCard label="Dialled"        achieved={calls.dialled}        target={callTargets.dialled}        />
          <Divider />
          <MetricCard label="Connected"      achieved={calls.connected}       target={callTargets.connected}      />
          <Divider />
          <MetricCard label="Mtgs Booked"    achieved={calls.meetingsBooked}  target={callTargets.meetingsBooked} />
        </div>

        {/* II — Meetings */}
        <div className="card">
          <ColHeader>Meetings</ColHeader>
          <MetricCard label="L1 Booked"    achieved={mtgs.l1Booked}    target={mtgTargets.l1Booked}    />
          <Divider />
          <MetricCard label="L1 Conducted" achieved={mtgs.l1Conducted} target={mtgTargets.l1Conducted} />
          <Divider />
          <MetricCard label="L2 Conducted" achieved={mtgs.l2Conducted} target={mtgTargets.l2Conducted} />
        </div>

        {/* III — Leads */}
        <div className="card">
          <ColHeader>Leads</ColHeader>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest">Hot</p>
              <p className="text-3xl font-semibold text-mh-text mt-1">{leads.hot}</p>
            </div>
            <Divider />
            <div>
              <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest">Warm</p>
              <p className="text-3xl font-semibold text-mh-text mt-1">{leads.warm}</p>
            </div>
            <Divider />
            <div>
              <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest">Cold</p>
              <p className="text-3xl font-semibold text-mh-text mt-1">{leads.cold}</p>
            </div>
            <Divider />
            <div>
              <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Total</p>
              <p className="text-xl font-medium text-mh-muted mt-1">{leads.total}</p>
            </div>
          </div>
        </div>

        {/* IV — Pipeline funnel */}
        <div className="card">
          <ColHeader>Pipeline</ColHeader>
          <FunnelColumn data={funnel} />
        </div>

        {/* V — Metrics graph */}
        <div className="card" style={{ minHeight: '340px' }}>
          <ColHeader>Trends</ColHeader>
          <div style={{ height: '280px' }}>
            <MetricsGraph data={weeklyTrend} />
          </div>
        </div>
      </div>

      {/* Weekly summary */}
      <div className="mt-4">
        <div className="card">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">
            Weekly Summary
          </p>
          {weeklySummary ? (
            <div className="space-y-2">
              {weeklySummary.split('\n').filter(l => l.trim()).map((line, i) => (
                <p key={i} className="text-sm text-mh-text leading-relaxed">{line}</p>
              ))}
            </div>
          ) : (
            <p className="text-mh-muted text-sm italic leading-relaxed">
              No summary yet — use <span className="text-mh-text">/mh stats weekly</span> in Discord to generate one.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
