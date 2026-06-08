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

  const calls       = callsData[period]
  const callTargets = callsData.targets[period]
  const mtgs        = meetingsData[period]
  const mtgTargets  = meetingsData.targets[period]

  return (
    <div className="space-y-4">
      {/* Row 0: period toggle */}
      <div className="flex items-center justify-end">
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

      {/* Row 1: Calls | Leads strip | Meetings */}
      <div className="grid grid-cols-[200px_1fr_200px] gap-4 items-start">

        {/* Calls */}
        <div className="card">
          <ColHeader>Calls</ColHeader>
          <MetricCard label="Dialled"     achieved={calls.dialled}       target={callTargets.dialled}        animationDelay={0}   />
          <Divider />
          <MetricCard label="Connected"   achieved={calls.connected}      target={callTargets.connected}      animationDelay={120} />
          <Divider />
          <MetricCard label="Mtgs Booked" achieved={calls.meetingsBooked} target={callTargets.meetingsBooked}  animationDelay={240} />
        </div>

        {/* Leads strip — compact horizontal */}
        <div className="card py-3">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">Leads</p>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#E8341C', boxShadow: '0 0 6px rgba(232,52,28,0.7)' }} />
              <span className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest">Hot</span>
              <span className="text-2xl font-semibold text-mh-text ml-1" style={{ textShadow: '0 0 16px rgba(232,52,28,0.35)' }}>{leads.hot}</span>
            </div>
            <div className="w-px h-6 bg-mh-border shrink-0" />
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#FFD700', boxShadow: '0 0 6px rgba(255,215,0,0.5)' }} />
              <span className="text-[10px] font-semibold text-mh-gold uppercase tracking-widest">Warm</span>
              <span className="text-2xl font-semibold text-mh-text ml-1">{leads.warm}</span>
            </div>
            <div className="w-px h-6 bg-mh-border shrink-0" />
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#3A6AE0', boxShadow: '0 0 6px rgba(58,106,224,0.5)' }} />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6699FF]">Cold</span>
              <span className="text-2xl font-semibold text-mh-text ml-1">{leads.cold}</span>
            </div>
            <div className="w-px h-6 bg-mh-border shrink-0" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Total</span>
              <span className="text-xl font-medium text-mh-muted ml-1">{leads.total}</span>
            </div>
          </div>
        </div>

        {/* Meetings */}
        <div className="card">
          <ColHeader>Meetings</ColHeader>
          <MetricCard label="L1 Booked"    achieved={mtgs.l1Booked}    target={mtgTargets.l1Booked}    animationDelay={80}  />
          <Divider />
          <MetricCard label="L1 Conducted" achieved={mtgs.l1Conducted} target={mtgTargets.l1Conducted} animationDelay={200} />
          <Divider />
          <MetricCard label="L2 Conducted" achieved={mtgs.l2Conducted} target={mtgTargets.l2Conducted} animationDelay={320} />
        </div>
      </div>

      {/* Row 2: Pipeline (60%) | Trends (40%) */}
      <div className="grid grid-cols-[3fr_2fr] gap-4 items-start">

        {/* Pipeline */}
        <div className="card">
          <ColHeader>Pipeline</ColHeader>
          <FunnelColumn data={funnel} />
        </div>

        {/* Trends */}
        <div className="card" style={{ minHeight: '300px' }}>
          <ColHeader>Trends (8 weeks)</ColHeader>
          <div style={{ height: '260px' }}>
            <MetricsGraph data={weeklyTrend} />
          </div>
        </div>
      </div>

      {/* Row 3: Summary */}
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
  )
}
