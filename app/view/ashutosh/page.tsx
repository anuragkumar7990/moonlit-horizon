import { getDeals } from '@/lib/zoho'
import { buildFunnel, buildLeadCounts } from '@/lib/dashboard'
import PersonSelector from '@/components/PersonSelector'
import FunnelColumn from '@/components/FunnelColumn'

export const revalidate = 60

export default async function AshutoshPage() {
  const dealsRes = await Promise.allSettled([getDeals()])
  const deals = dealsRes[0].status === 'fulfilled' ? dealsRes[0].value : []

  const funnel = buildFunnel(deals)
  const leads  = buildLeadCounts(deals)

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
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">Pending Tasks</p>
          <p className="text-mh-muted text-sm italic leading-relaxed">
            Open tasks for Ashutosh, Anurag, and Tanishq will populate from the{' '}
            <span className="text-mh-text">Tasks</span> tab once the P0 Agent is live (Phase 2).
          </p>
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
