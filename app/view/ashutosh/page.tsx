import { getDeals } from '@/lib/zoho'
import { getTasks } from '@/lib/sheets'
import { buildFunnel, buildLeadCounts } from '@/lib/dashboard'
import PersonSelector from '@/components/PersonSelector'
import FunnelColumn from '@/components/FunnelColumn'

export const revalidate = 60

export default async function AshutoshPage() {
  const [dealsRes, tasksRes] = await Promise.allSettled([getDeals(), getTasks()])
  const deals    = dealsRes.status  === 'fulfilled' ? dealsRes.value  : []
  const allTasks = tasksRes.status  === 'fulfilled' ? tasksRes.value  : []

  const funnel    = buildFunnel(deals)
  const leads     = buildLeadCounts(deals)
  const openTasks = allTasks.filter(t => t.status === 'Open')

  const SOURCES = [
    'Events (Webinars + Conferences)',
    'Cold-Engineering (Apollo)',
    'Cold-L&D (Apollo)',
    'Email-Engineering',
    'Email-L&D',
    'Referrals',
    'Internal Community',
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <PersonSelector />
      </div>

      {/* Row 1: Leads + Funnel + Prospect DB */}
      <div className="grid grid-cols-[160px_200px_1fr] gap-4 mb-4">

        {/* Leads */}
        <div className="card">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-4">Leads</p>
          <div className="space-y-3">
            {[
              { label: 'Hot',   val: leads.hot,   color: 'text-mh-vermillion' },
              { label: 'Warm',  val: leads.warm,  color: 'text-mh-gold'       },
              { label: 'Cold',  val: leads.cold,  color: 'text-mh-muted'      },
            ].map(item => (
              <div key={item.label}>
                <p className={`text-[10px] font-semibold uppercase tracking-widest ${item.color}`}>{item.label}</p>
                <p className="text-2xl font-semibold text-mh-text mt-0.5">{item.val}</p>
              </div>
            ))}
            <div className="border-t border-mh-border pt-3">
              <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Total</p>
              <p className="text-xl font-medium text-mh-muted mt-0.5">{leads.total}</p>
            </div>
          </div>
        </div>

        {/* Funnel */}
        <div className="card">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-4">Pipeline</p>
          <FunnelColumn data={funnel} />
        </div>

        {/* Prospect DB Health */}
        <div className="card">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-4">Prospect DB Health</p>
          <p className="text-mh-muted text-sm italic leading-relaxed mb-4">
            Metrics populate once leads are uploaded to the{' '}
            <span className="text-mh-text">Prospects</span> tab.
            Shows total uncalled stock, weeks remaining, and source breakdown.
          </p>
          <div className="space-y-2">
            <p className="text-[10px] text-mh-muted uppercase tracking-widest mb-1">Sources tracked</p>
            {SOURCES.map(s => (
              <div key={s} className="flex items-center justify-between py-1 border-b border-mh-border last:border-0">
                <span className="text-xs text-mh-muted">{s}</span>
                <span className="text-xs text-mh-muted">—</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Email + Tasks */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="card">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">Email Status</p>
          <p className="text-mh-muted text-sm italic leading-relaxed">
            Email metrics available in Phase 2 via Gmail API — shows emails sent,
            open rate, unactioned threads, and campaign performance per source.
          </p>
        </div>
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
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {openTasks.map((t, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-mh-surface2 border border-mh-border"
                >
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

      {/* Row 3: Objectives */}
      <div className="card">
        <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">Objective Progress</p>
        <p className="text-mh-muted text-sm italic leading-relaxed">
          Objective tracking live in Phase 2b — updated via{' '}
          <span className="text-mh-text">/objective update</span> in Discord.
          Covers: Lead Generation, Calling, Meetings, Lead Conversion, Trainer Supply, Revenue, Team Capacity.
        </p>
      </div>
    </div>
  )
}
