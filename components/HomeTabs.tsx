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

      <div className="flex gap-0 mb-6 border-b border-mh-border overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap
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
