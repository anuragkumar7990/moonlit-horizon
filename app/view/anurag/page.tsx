import { format, parseISO, isAfter } from 'date-fns'
import { getMeetings, getTasks, getPayments } from '@/lib/sheets'
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

function fmtAmount(n: number): string {
  if (!n) return '₹0'
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`
  return `₹${n.toLocaleString('en-IN')}`
}

function isOverdue(dueDate: string, status: string): boolean {
  if (status === 'Received') return false
  try { return isAfter(new Date(), parseISO(dueDate)) } catch { return false }
}

const STATUS_STYLE: Record<string, string> = {
  Received: 'bg-green-500/15 text-green-400',
  Invoiced: 'bg-mh-vermillion/15 text-mh-vermillion',
  Partial:  'bg-mh-gold/15 text-mh-gold',
  Overdue:  'bg-red-500/15 text-red-400',
}

export default async function AnuragPage() {
  const [meetingsRes, dealsRes, tasksRes, paymentsRes] = await Promise.allSettled([
    getMeetings(),
    getDeals(),
    getTasks(),
    getPayments(),
  ])

  const meetings = meetingsRes.status  === 'fulfilled' ? meetingsRes.value  : []
  const deals    = dealsRes.status     === 'fulfilled' ? dealsRes.value     : []
  const allTasks = tasksRes.status     === 'fulfilled' ? tasksRes.value     : []
  const payments = paymentsRes.status  === 'fulfilled' ? paymentsRes.value  : []

  const funnel        = buildFunnel(deals)
  const todayMeetings = buildTodaysMeetings(meetings)
  const openTasks     = allTasks.filter(t => t.status === 'Open')

  // Payment summaries
  const pending  = payments.filter(p => p.status !== 'Received')
  const received = payments.filter(p => p.status === 'Received')
  const overdue  = pending.filter(p => isOverdue(p.dueDate, p.status))

  const totalInvoiced  = payments.reduce((s, p) => s + p.amount, 0)
  const totalReceived  = received.reduce((s, p) => s + p.amount, 0)
  const totalOutstanding = pending.reduce((s, p) => s + p.amount, 0)

  // Sort: overdue first, then by due date ascending
  const sortedPayments = [...payments].sort((a, b) => {
    const aOver = isOverdue(a.dueDate, a.status) ? 0 : 1
    const bOver = isOverdue(b.dueDate, b.status) ? 0 : 1
    if (aOver !== bOver) return aOver - bOver
    return a.dueDate.localeCompare(b.dueDate)
  })

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
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
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
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">
            Pending Tasks
            {openTasks.length > 0 && (
              <span className="text-mh-vermillion ml-2">{openTasks.length}</span>
            )}
          </p>
          {openTasks.length === 0 ? (
            <p className="text-mh-muted text-sm italic">No open tasks</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {openTasks.map((t, i) => (
                <div key={i} className="p-3 rounded-lg bg-mh-surface2 border border-mh-border">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-mh-text leading-snug flex-1">{t.task}</p>
                    <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                      t.type === 'P0' ? 'bg-mh-vermillion/15 text-mh-vermillion' : 'bg-mh-surface border border-mh-border text-mh-muted'
                    }`}>
                      {t.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    {t.assignedTo && (
                      <span className="text-[10px] text-mh-muted uppercase tracking-widest">{t.assignedTo}</span>
                    )}
                    {t.linkedDeal && (
                      <span className="text-[10px] text-mh-muted truncate">{t.linkedDeal}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Funnel + Payments */}
      <div className="grid grid-cols-[200px_1fr] gap-4 mb-4">
        <div className="card">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-4">Pipeline</p>
          <FunnelColumn data={funnel} />
        </div>

        {/* Payments Pending */}
        <div className="card">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-4">
            Payments Pending
            {overdue.length > 0 && (
              <span className="text-red-400 ml-2">{overdue.length} overdue</span>
            )}
          </p>

          {payments.length === 0 ? (
            <p className="text-mh-muted text-sm italic">
              No payments logged yet. Use{' '}
              <span className="text-mh-text font-medium">/mh log payment</span>{' '}
              in Discord to add one.
            </p>
          ) : (
            <>
              {/* Summary row */}
              <div className="flex items-end gap-6 mb-4">
                <div>
                  <p className="text-[10px] text-mh-muted uppercase tracking-widest">Total Invoiced</p>
                  <p className="text-2xl font-semibold text-mh-text mt-0.5">{fmtAmount(totalInvoiced)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-mh-muted uppercase tracking-widest">Received</p>
                  <p className="text-2xl font-semibold text-green-400 mt-0.5">{fmtAmount(totalReceived)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-mh-muted uppercase tracking-widest">Outstanding</p>
                  <p className={`text-2xl font-semibold mt-0.5 ${totalOutstanding > 0 ? 'text-mh-vermillion' : 'text-mh-muted'}`}>
                    {fmtAmount(totalOutstanding)}
                  </p>
                </div>
              </div>

              {/* Payment rows */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {sortedPayments.map((p, i) => {
                  const over = isOverdue(p.dueDate, p.status)
                  const displayStatus = over && p.status !== 'Received' ? 'Overdue' : p.status
                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${over ? 'bg-red-500/5 border-red-500/30' : 'bg-mh-surface2 border-mh-border'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-mh-text truncate">{p.account}</p>
                          {p.deal && <p className="text-xs text-mh-muted truncate mt-0.5">{p.deal}</p>}
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-[10px] text-mh-muted">
                              Inv: <span className="text-mh-text">{p.invoiceDate}</span>
                            </p>
                            <p className="text-[10px] text-mh-muted">
                              Due: <span className={over ? 'text-red-400 font-semibold' : 'text-mh-text'}>{p.dueDate}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <p className="text-sm font-semibold text-mh-text">{fmtAmount(p.amount)}</p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide ${STATUS_STYLE[displayStatus] ?? STATUS_STYLE['Invoiced']}`}>
                            {displayStatus}
                          </span>
                        </div>
                      </div>
                      {p.notes && (
                        <p className="text-[10px] text-mh-muted mt-1.5 italic">{p.notes}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
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
