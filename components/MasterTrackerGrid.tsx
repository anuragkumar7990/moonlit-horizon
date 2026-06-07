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
        <div className="flex items-center gap-1 rounded-full p-1"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {(['weekly', 'monthly'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="text-xs px-4 py-1.5 rounded-full font-medium capitalize transition-all"
              style={period === p
                ? { background: 'linear-gradient(135deg, #E8341C, #FF5A3A)', color: '#fff', boxShadow: '0 0 10px rgba(232,52,28,0.35)' }
                : { color: '#888899' }
              }
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* 5-column master grid */}
      <div className="grid grid-cols-[180px_180px_160px_200px_1fr] gap-4 items-start">

        {/* I — Calls */}
        <div className="card" style={{ animationDelay: '0ms' }}>
          <ColHeader>Calls</ColHeader>
          <MetricCard label="Dialled"     achieved={calls.dialled}       target={callTargets.dialled}       animationDelay={0}   />
          <Divider />
          <MetricCard label="Connected"   achieved={calls.connected}      target={callTargets.connected}     animationDelay={120} />
          <Divider />
          <MetricCard label="Mtgs Booked" achieved={calls.meetingsBooked} target={callTargets.meetingsBooked} animationDelay={240} />
        </div>

        {/* II — Meetings */}
        <div className="card" style={{ animationDelay: '80ms' }}>
          <ColHeader>Meetings</ColHeader>
          <MetricCard label="L1 Booked"    achieved={mtgs.l1Booked}    target={mtgTargets.l1Booked}    animationDelay={80}  />
          <Divider />
          <MetricCard label="L1 Conducted" achieved={mtgs.l1Conducted} target={mtgTargets.l1Conducted} animationDelay={200} />
          <Divider />
          <MetricCard label="L2 Conducted" achieved={mtgs.l2Conducted} target={mtgTargets.l2Conducted} animationDelay={320} />
        </div>

        {/* III — Leads */}
        <div className="card" style={{ animationDelay: '160ms' }}>
          <ColHeader>Leads</ColHeader>
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="pulse-dot bg-[#E8341C]" style={{ color: '#E8341C' }} />
                <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest">Hot</p>
              </div>
              <p className="text-3xl font-semibold text-mh-text" style={{ textShadow: '0 0 20px rgba(232,52,28,0.4)' }}>{leads.hot}</p>
            </div>
            <Divider />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="pulse-dot bg-[#FFD700]" style={{ color: '#FFD700', animationDelay: '0.5s' }} />
                <p className="text-[10px] font-semibold text-mh-gold uppercase tracking-widest">Warm</p>
              </div>
              <p className="text-3xl font-semibold text-mh-text">{leads.warm}</p>
            </div>
            <Divider />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="pulse-dot bg-[#3A6AE0]" style={{ color: '#3A6AE0', animationDelay: '1s' }} />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6699FF]">Cold</p>
              </div>
              <p className="text-3xl font-semibold text-mh-text">{leads.cold}</p>
            </div>
            <Divider />
            <div>
              <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Total</p>
              <p className="text-xl font-medium text-mh-muted mt-1">{leads.total}</p>
            </div>
          </div>
        </div>

        {/* IV — Pipeline funnel */}
        <div className="card" style={{ animationDelay: '240ms' }}>
          <ColHeader>Pipeline</ColHeader>
          <FunnelColumn data={funnel} />
        </div>

        {/* V — Metrics graph */}
        <div className="card" style={{ minHeight: '340px', animationDelay: '320ms' }}>
          <ColHeader>Trends</ColHeader>
          <div style={{ height: '280px' }}>
            <MetricsGraph data={weeklyTrend} />
          </div>
        </div>
      </div>

      {/* Summary — changes with period toggle */}
      <div className="mt-4">
        <div className="card">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">
            {period === 'weekly' ? 'Weekly Summary' : 'Monthly Summary'}
          </p>
          {period === 'weekly' ? (
            weeklySummary ? (
              <div className="space-y-2">
                {weeklySummary.split('\n').filter(l => l.trim()).map((line, i) => (
                  <p key={i} className="text-sm text-mh-text leading-relaxed">{line}</p>
                ))}
              </div>
            ) : (
              <p className="text-mh-muted text-sm italic leading-relaxed">
                No summary yet — use <span className="text-mh-text">/mh stats weekly</span> in Discord to generate one.
              </p>
            )
          ) : (
            <p className="text-mh-muted text-sm italic leading-relaxed">
              No monthly summary yet — use <span className="text-mh-text">/mh stats monthly</span> in Discord to generate one.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
