'use client'
import { useState, useRef, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
import ObjectivesModule from './ObjectivesModule'
import DailyScrumModule from './DailyScrumModule'
import WBRModule from './WBRModule'
import CalendarModule from './CalendarModule'
import type { Call, Meeting, LeadCounts, FunnelData, WeeklyPoint } from '@/lib/types'
import type { CallsColumnData, MeetingsColumnData } from '@/lib/dashboard'
import type { CalendarEvent } from '@/lib/booking'

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
  weeklySummary?:  string | null
  monthlySummary?: string | null
  rawCalls:        Call[]
  rawMeetings:     Meeting[]
  calEvents:       CalendarEvent[]
}

const PRIMARY_TABS: { id: Tab; label: string }[] = [
  { id: 'calling',  label: 'Calls'     },
  { id: 'deals',    label: 'Deals'     },
  { id: 'calendar', label: 'Calendar'  },
  { id: 'emails',   label: 'Emails'    },
  { id: 'accounts', label: 'Accounts'  },
]

interface OthersGroup { label: string; items: { id: Tab; label: string }[] }

const OTHERS_GROUPS: OthersGroup[] = [
  {
    label: 'Daily Use',
    items: [
      { id: 'scrum',     label: 'Daily Scrum'        },
      { id: 'p0tasks',   label: 'Tasks'               },
      { id: 'prospects', label: 'Prospects Database'  },
    ],
  },
  {
    label: 'Pipeline & Revenue',
    items: [
      { id: 'wbr',        label: 'WBR'        },
      { id: 'objectives', label: 'Objectives' },
      { id: 'targets',    label: 'Targets'    },
      { id: 'payments',   label: 'Payments'   },
      { id: 'followups',  label: 'Follow-Ups' },
    ],
  },
  {
    label: 'Data & Intelligence',
    items: [
      { id: 'contacts', label: 'Contacts'   },
      { id: 'events',   label: 'Event Intel'},
      { id: 'supply',   label: 'Supply'     },
      { id: 'updates',  label: 'Updates'    },
    ],
  },
]

const ALL_OTHERS = OTHERS_GROUPS.flatMap(g => g.items)
const OTHERS_IDS = new Set<Tab>(ALL_OTHERS.map(i => i.id))

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
    </div>
  )
}

function OthersDropdown({
  activeTab,
  onSelect,
}: {
  activeTab: Tab
  onSelect: (id: Tab) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isOthersActive = OTHERS_IDS.has(activeTab)

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const q = query.toLowerCase()
  const filteredGroups = q
    ? [{ label: 'Results', items: ALL_OTHERS.filter(i => i.label.toLowerCase().includes(q)) }]
    : OTHERS_GROUPS

  function select(id: Tab) {
    onSelect(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition-all select-none"
        style={
          isOthersActive
            ? {
                background: 'linear-gradient(135deg, #E8341C, #FF5A3A)',
                color: '#fff',
                boxShadow: '0 0 18px rgba(232,52,28,0.45)',
              }
            : {
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#888899',
              }
        }
      >
        Others
        <svg
          className="w-3.5 h-3.5 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-50 rounded-xl overflow-hidden"
          style={{
            width: '240px',
            background: 'rgba(10,10,18,0.96)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
            backdropFilter: 'blur(24px)',
          }}
        >
          {/* Search */}
          <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search modules..."
              className="w-full bg-transparent text-sm text-mh-text placeholder:text-mh-muted outline-none"
            />
          </div>

          {/* Groups */}
          <div className="py-2 max-h-80 overflow-y-auto">
            {filteredGroups.map(group => (
              <div key={group.label}>
                <p className="px-4 pt-2 pb-1 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">
                  {group.label}
                </p>
                {group.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => select(item.id)}
                    className="w-full flex items-center justify-between px-4 py-2 text-sm transition-colors text-left"
                    style={
                      activeTab === item.id
                        ? { color: '#E8341C', background: 'rgba(232,52,28,0.08)' }
                        : { color: '#C8C8D8' }
                    }
                    onMouseEnter={e => { if (activeTab !== item.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                    onMouseLeave={e => { if (activeTab !== item.id) (e.currentTarget as HTMLElement).style.background = '' }}
                  >
                    {item.label}
                    {activeTab === item.id && (
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#E8341C' }} />
                    )}
                  </button>
                ))}
              </div>
            ))}
            {filteredGroups[0]?.items.length === 0 && (
              <p className="px-4 py-3 text-sm text-mh-muted italic">No modules found</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function HomeTabs({
  callsData, meetingsData, leads, funnel, weeklyTrend, weeklySummary, monthlySummary, rawCalls, rawMeetings, calEvents,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<Tab>('tracker')

  function selectTab(id: Tab) {
    setTab(prev => (prev === id ? 'tracker' : id))
  }

  function refresh() {
    startTransition(async () => {
      await fetch('/api/sync-zoho-calls?key=thetesttribe', {
        headers: { 'Authorization': 'Basic OnRoZXRlc3R0cmliZQ==' },
      })
      router.refresh()
    })
  }

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <ViewDropdown />
        <button
          onClick={refresh}
          disabled={isPending}
          title="Refresh all data"
          className="flex items-center gap-1.5 text-xs text-mh-muted hover:text-mh-text border border-mh-border hover:border-mh-vermillion/40 rounded-lg px-3 py-1.5 transition-all disabled:opacity-40"
        >
          <svg className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isPending ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Primary navigation */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {PRIMARY_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => selectTab(t.id)}
            className="px-5 py-2 rounded-full text-sm font-semibold transition-all select-none"
            style={
              tab === t.id
                ? {
                    background: 'linear-gradient(135deg, #E8341C, #FF5A3A)',
                    color: '#fff',
                    boxShadow: '0 0 18px rgba(232,52,28,0.45)',
                  }
                : {
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#888899',
                  }
            }
          >
            {t.label}
          </button>
        ))}

        <OthersDropdown activeTab={tab} onSelect={id => setTab(id)} />
      </div>

      {/* Content */}
      {tab === 'tracker' && (
        <MasterTrackerGrid
          callsData={callsData}
          meetingsData={meetingsData}
          leads={leads}
          funnel={funnel}
          weeklyTrend={weeklyTrend}
          weeklySummary={weeklySummary}
          monthlySummary={monthlySummary}
        />
      )}
      {tab === 'calling'    && <CallingModule calls={rawCalls} calEvents={calEvents} />}
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
      {tab === 'calendar'   && <CalendarModule rawMeetings={rawMeetings} calEvents={calEvents} />}
      {tab === 'objectives' && <ObjectivesModule />}
      {tab === 'scrum'      && <DailyScrumModule />}
      {tab === 'wbr'        && <WBRModule />}
    </div>
  )
}
