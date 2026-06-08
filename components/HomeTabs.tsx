'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
import ContactTrackerModule from './ContactTrackerModule'
import DealsModule from './DealsModule'
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
  | 'deals'
  | 'calendar'
  | 'objectives'
  | 'scrum'
  | 'wbr'

interface Props {
  callsData:     CallsColumnData
  meetingsData:  MeetingsColumnData
  leads:         LeadCounts
  funnel:        FunnelData
  weeklyTrend:   WeeklyPoint[]
  weeklySummary?: string | null
  rawCalls:      Call[]
}

const IMPORTANT_TABS: { id: Tab; label: string }[] = [
  { id: 'tracker',  label: 'Master Tracker' },
  { id: 'calling',  label: 'Calls' },
  { id: 'deals',    label: 'Deals' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'emails',   label: 'Emails' },
  { id: 'accounts', label: 'Accounts' },
]

const SECONDARY_TABS: { id: Tab; label: string }[] = [
  { id: 'contacts',   label: 'Contacts' },
  { id: 'prospects',  label: 'Uncalled Leads' },
  { id: 'payments',   label: 'Payments' },
  { id: 'targets',    label: 'Targets' },
  { id: 'events',     label: 'Event Intel' },
  { id: 'supply',     label: 'Supply' },
  { id: 'followups',  label: 'Follow-Ups' },
  { id: 'updates',    label: 'Updates' },
  { id: 'p0tasks',    label: 'P0 Tasks' },
  { id: 'objectives', label: 'Objectives' },
  { id: 'scrum',      label: 'Daily Scrum' },
  { id: 'wbr',        label: 'WBR' },
]

const ALL_TABS = [...IMPORTANT_TABS, ...SECONDARY_TABS]

const PEOPLE = [
  { name: 'Mahesh',   href: '/view/mahesh'   },
  { name: 'Ashutosh', href: '/view/ashutosh' },
  { name: 'Anurag',   href: '/view/anurag'   },
  { name: 'Tanishq',  href: '/view/tanishq'  },
]

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(232,52,28,0.08)', border: '1px solid rgba(232,52,28,0.2)' }}
      >
        <span className="text-2xl">🚧</span>
      </div>
      <p className="text-mh-text font-semibold text-lg">{label}</p>
      <p className="text-mh-muted text-sm">This module is coming soon.</p>
    </div>
  )
}

function ViewDropdown() {
  const pathname = usePathname()
  const activePerson = PEOPLE.find(p => pathname === p.href)

  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">View</span>
      <div className="flex items-center gap-1">
        {PEOPLE.map((p) => {
          const active = pathname === p.href
          return (
            <Link
              key={p.href}
              href={p.href}
              className={`px-3 py-1 rounded-md text-xs font-medium border transition-all select-none
                ${active
                  ? 'border-mh-vermillion text-mh-vermillion bg-mh-surface'
                  : 'border-transparent text-mh-muted hover:text-mh-text hover:border-mh-border'
                }`}
            >
              {p.name}
            </Link>
          )
        })}
      </div>
      {activePerson && (
        <span className="text-[10px] text-mh-muted hidden sm:inline">— {activePerson.name}&apos;s view</span>
      )}
    </div>
  )
}

export default function HomeTabs({
  callsData, meetingsData, leads, funnel, weeklyTrend, weeklySummary, rawCalls,
}: Props) {
  const [tab, setTab] = useState<Tab>('tracker')
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)

  useEffect(() => {
    const idx = ALL_TABS.findIndex(t => t.id === tab)
    const el = btnRefs.current[idx]
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [tab])

  return (
    <div>
      {/* Top bar: View selector + secondary tabs hint */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <ViewDropdown />
      </div>

      {/* Tab bar — Important left, Secondary right (smaller) */}
      <div
        className="relative flex items-end mb-6 overflow-x-auto gap-0"
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

        {/* Important tabs */}
        {IMPORTANT_TABS.map((t, i) => (
          <button
            key={t.id}
            ref={el => { btnRefs.current[i] = el }}
            onClick={() => setTab(t.id)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-all -mb-px whitespace-nowrap
              ${tab === t.id ? 'text-white' : 'text-mh-muted hover:text-white'}`}
            style={tab === t.id ? { textShadow: '0 0 12px rgba(255,255,255,0.4)' } : undefined}
          >
            {t.label}
          </button>
        ))}

        {/* Divider */}
        <div className="self-center h-4 w-px mx-2 shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }} />

        {/* Secondary tabs */}
        {SECONDARY_TABS.map((t, i) => (
          <button
            key={t.id}
            ref={el => { btnRefs.current[IMPORTANT_TABS.length + i] = el }}
            onClick={() => setTab(t.id)}
            className={`relative px-3 py-2.5 text-xs font-medium transition-all -mb-px whitespace-nowrap
              ${tab === t.id ? 'text-white' : 'text-mh-muted/70 hover:text-mh-muted'}`}
            style={tab === t.id ? { textShadow: '0 0 12px rgba(255,255,255,0.3)' } : undefined}
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
      {tab === 'calling'    && <CallingModule calls={rawCalls} />}
      {tab === 'accounts'   && <AccountsModule />}
      {tab === 'contacts'   && <ContactsModule />}
      {tab === 'prospects'  && <ProspectModule />}
      {tab === 'payments'   && <PaymentsModule />}
      {tab === 'emails'     && <EmailsModule />}
      {tab === 'targets'    && <TargetsModule />}
      {tab === 'events'     && <EventIntelModule />}
      {tab === 'supply'     && <SupplyModule />}
      {tab === 'p0tasks'    && <P0TasksModule />}
      {tab === 'followups'  && <ContactTrackerModule />}
      {tab === 'updates'    && <UpdatesModule />}
      {tab === 'deals'      && <DealsModule />}
      {tab === 'calendar'   && <ComingSoon label="Calendar" />}
      {tab === 'objectives' && <ComingSoon label="Objectives" />}
      {tab === 'scrum'      && <ComingSoon label="Daily Scrum" />}
      {tab === 'wbr'        && <ComingSoon label="Weekly Business Review" />}
    </div>
  )
}
