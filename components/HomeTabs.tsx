'use client'
import { useState } from 'react'
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

  return (
    <div>
      {/* Person selector — centred above tabs */}
      <div className="flex justify-center mb-6">
        <PersonSelector />
      </div>

      <div className="relative flex gap-0 mb-6 overflow-x-auto"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-all -mb-px whitespace-nowrap
              ${tab === t.id
                ? 'text-white'
                : 'text-mh-muted hover:text-white'
              }`}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full"
                style={{ background: 'linear-gradient(90deg, transparent, #E8341C 30%, #E8341C 70%, transparent)' }}
              />
            )}
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
    </div>
  )
}
