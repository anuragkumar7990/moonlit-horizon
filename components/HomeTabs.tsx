'use client'
import { useState } from 'react'
import MasterTrackerGrid from './MasterTrackerGrid'
import CallingModule from './CallingModule'
import type { Call, LeadCounts, FunnelData, WeeklyPoint } from '@/lib/types'
import type { CallsColumnData, MeetingsColumnData } from '@/lib/dashboard'

type Tab = 'tracker' | 'calling'

interface Props {
  callsData:     CallsColumnData
  meetingsData:  MeetingsColumnData
  leads:         LeadCounts
  funnel:        FunnelData
  weeklyTrend:   WeeklyPoint[]
  weeklySummary?: string | null
  rawCalls:      Call[]
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'tracker', label: 'Master Tracker' },
  { id: 'calling', label: 'Calling' },
]

export default function HomeTabs({
  callsData, meetingsData, leads, funnel, weeklyTrend, weeklySummary, rawCalls,
}: Props) {
  const [tab, setTab] = useState<Tab>('tracker')

  return (
    <div>
      <div className="flex gap-0 mb-6 border-b border-mh-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${tab === t.id
                ? 'border-mh-vermillion text-mh-vermillion'
                : 'border-transparent text-mh-muted hover:text-mh-text'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'tracker' && (
        <MasterTrackerGrid
          callsData={callsData}
          meetingsData={meetingsData}
          leads={leads}
          funnel={funnel}
          weeklyTrend={weeklyTrend}
          weeklySummary={weeklySummary}
        />
      )}

      {tab === 'calling' && (
        <CallingModule calls={rawCalls} />
      )}
    </div>
  )
}
