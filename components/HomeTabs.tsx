'use client'
import { useState, useRef, useEffect } from 'react'
import MasterTrackerGrid from './MasterTrackerGrid'
import CallingModule from './CallingModule'
import ProspectModule from './ProspectModule'
import AccountsModule from './AccountsModule'
import ContactsModule from './ContactsModule'
import PaymentsModule from './PaymentsModule'
import UpdatesModule from './UpdatesModule'
import EmailsModule from './EmailsModule'
import TargetsModule from './TargetsModule'
import EventIntelModule from './EventIntelModule'
import SupplyModule from './SupplyModule'
import P0TasksModule from './P0TasksModule'
import FollowUpsModule from './FollowUpsModule'
import PersonSelector from './PersonSelector'
import type { Call, LeadCounts, FunnelData, WeeklyPoint } from '@/lib/types'
import type { CallsColumnData, MeetingsColumnData } from '@/lib/dashboard'

type Tab =
  | 'tracker'
  | 'calling'
  | 'accounts'
  | 'contacts'
  | 'prospects'
  | 'payments'
  | 'updates'
  | 'emails'
  | 'targets'
  | 'events'
  | 'supply'
  | 'p0tasks'
  | 'followups'

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
  { id: 'tracker',   label: 'Master Tracker' },
  { id: 'p0tasks',   label: 'P0 Tasks' },
  { id: 'followups', label: 'Follow-Ups' },
  { id: 'updates',   label: 'Updates' },
  { id: 'calling',   label: 'Calling' },
  { id: 'accounts',  label: 'Accounts' },
  { id: 'contacts',  label: 'Contacts' },
  { id: 'prospects', label: 'Prospect DB' },
  { id: 'payments',  label: 'Payments' },
  { id: 'emails',    label: 'Emails' },
  { id: 'targets',   label: 'Targets' },
  { id: 'events',    label: 'Event Intel' },
  { id: 'supply',    label: 'Supply' },
]

export default function HomeTabs({
  callsData, meetingsData, leads, funnel, weeklyTrend, weeklySummary, rawCalls,
}: Props) {
  const [tab, setTab] = useState<Tab>('tracker')
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)

  useEffect(() => {
    const idx = TABS.findIndex(t => t.id === tab)
    const el = btnRefs.current[idx]
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [tab])

  return (
    <div>
      {/* Person selector — centred above tabs */}
      <div className="flex justify-center mb-6">
        <PersonSelector />
      </div>

      <div className="relative flex gap-0 mb-6 overflow-x-auto"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Sliding underline indicator */}
        {indicator && (
          <span
            className="absolute bottom-0 h-0.5 rounded-t-full pointer-events-none"
            style={{
              left: indicator.left,
              width: indicator.width,
              background: 'linear-gradient(90deg, transparent, #E8341C 30%, #E8341C 70%, transparent)',
              transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1), width 0.25s cubic-bezier(0.4,0,0.2,1)',
              boxShadow: '0 0 8px rgba(232,52,28,0.6)',
            }}
          />
        )}

        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={el => { btnRefs.current[i] = el }}
            onClick={() => setTab(t.id)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-all -mb-px whitespace-nowrap
              ${tab === t.id
                ? 'text-white'
                : 'text-mh-muted hover:text-white'
              }`}
            style={tab === t.id ? { textShadow: '0 0 12px rgba(255,255,255,0.4)' } : undefined}
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
      {tab === 'updates'   && <UpdatesModule />}
      {tab === 'calling'   && <CallingModule calls={rawCalls} />}
      {tab === 'accounts'  && <AccountsModule />}
      {tab === 'contacts'  && <ContactsModule />}
      {tab === 'prospects' && <ProspectModule />}
      {tab === 'payments'  && <PaymentsModule />}
      {tab === 'emails'    && <EmailsModule />}
      {tab === 'targets'   && <TargetsModule />}
      {tab === 'events'    && <EventIntelModule />}
      {tab === 'supply'    && <SupplyModule />}
      {tab === 'p0tasks'   && <P0TasksModule />}
      {tab === 'followups' && <FollowUpsModule />}
    </div>
  )
}
