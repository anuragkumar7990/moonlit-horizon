import { format, parseISO } from 'date-fns'
import { getMeetings } from '@/lib/sheets'
import { getDeals } from '@/lib/zoho'
import { buildFunnel, buildTodaysMeetings } from '@/lib/dashboard'
import PersonSelector from '@/components/PersonSelector'
import FunnelColumn from '@/components/FunnelColumn'

export const revalidate = 60

const QUICK_LINKS = [
  { label: 'Zoho CRM',        href: 'https://crm.zoho.in',         desc: 'Deals, contacts, accounts'    },
  { label: 'Google Sheets',   href: 'https://sheets.google.com',   desc: 'Prospects, calls, meetings'   },
  { label: 'Google Calendar', href: 'https://calendar.google.com', desc: 'Upcoming meetings'             },
  { label: 'Discord',         href: 'https://discord.com',         desc: '#sales-ops · #stats · #p0'    },
  { label: 'Upload Prospects',href: '/upload',                     desc: 'Add new leads to the system'  },
  { label: 'Book Meeting',    href: '/',                           desc: 'Create a new meeting record'   },
]

function fmtTime(dt: string): string {
  try { return format(parseISO(dt), 'h:mm a') } catch { return dt }
}

export default async function AnuragPage() {
  const [meetingsRes, dealsRes] = await Promise.allSettled([
    getMeetings(),
    getDeals(),
  ])

  const meetings = meetingsRes.status === 'fulfilled' ? meetingsRes.value : []
  const deals    = dealsRes.status    === 'fulfilled' ? dealsRes.value    : []

  const funnel        = buildFunnel(deals)
  const todayMeetings = buildTodaysMeetings(meetings)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <PersonSelector />
      </div>

      {/* Row 1: Today's Meetings + Tasks */}
      <div className="grid grid-cols-2 gap-4 mb-4">

        {/* Meetings today */}
        <div className="card">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-4">
            Meetings Today
            {todayMeetings.length > 0 && (
              <span className="text-mh-vermillion ml-2">{todayMeetings.length}</span>
            )}
          </p>
          {todayMeetings.length === 0 ? (
            <p className="text-mh-muted text-sm italic">No meetings today</p>
          ) : (
            <div className="space-y-3">
              {todayMeetings.map(m => (
                <div
                  key={m.meetingId}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg bg-mh-surface2 border border-mh-border"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-mh-text truncate">{m.accountName}</p>
                    <p className="text-xs text-mh-muted mt-0.5">{m.contactName} · {m.meetingType}</p>
                    <p className="text-xs text-mh-vermillion mt-0.5">{fmtTime(m.meetingTime)}</p>
                  </div>
                  {m.gMeetLink && (
                    <a
                      href={m.gMeetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs px-2 py-1 rounded bg-mh-surface border border-mh-border
                        text-mh-muted hover:text-mh-text hover:border-mh-vermillion transition-colors"
                    >
                      Join
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending tasks */}
        <div className="card">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">Pending Tasks</p>
          <p className="text-mh-muted text-sm italic leading-relaxed">
            All open tasks across Tanishq, Ashutosh, and Anurag will appear here
            once the <span className="text-mh-text">Tasks</span> tab is populated (Phase 2).
          </p>
        </div>
      </div>

      {/* Row 2: Funnel + Payments */}
      <div className="grid grid-cols-[200px_1fr] gap-4 mb-4">
        <div className="card">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-4">Pipeline</p>
          <FunnelColumn data={funnel} />
        </div>
        <div className="card">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">Payments Pending</p>
          <p className="text-mh-muted text-sm italic leading-relaxed">
            Invoice and payment tracking via the <span className="text-mh-text">Payments</span> tab —
            shows invoiced, received, outstanding this month, and overdue invoices.
            Live in Phase 2.
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="card">
        <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-4">Quick Links</p>
        <div className="grid grid-cols-3 gap-3">
          {QUICK_LINKS.map(link => (
            <a
              key={link.label}
              href={link.href}
              className="p-3 rounded-lg bg-mh-surface2 border border-mh-border
                hover:border-mh-vermillion transition-colors group"
            >
              <p className="text-sm font-medium text-mh-text group-hover:text-mh-vermillion transition-colors">
                {link.label}
              </p>
              <p className="text-xs text-mh-muted mt-0.5">{link.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
