import { getDeals } from '@/lib/zoho'
import { getTasks, getProspects } from '@/lib/sheets'
import { buildFunnel, buildLeadCounts } from '@/lib/dashboard'
import PersonSelector from '@/components/PersonSelector'
import FunnelColumn from '@/components/FunnelColumn'

export const revalidate = 60

const WEEKLY_CALL_CAPACITY = 250

export default async function AshutoshPage() {
  const [dealsRes, tasksRes, prospectsRes] = await Promise.allSettled([
    getDeals(), getTasks(), getProspects(),
  ])
  const deals     = dealsRes.status     === 'fulfilled' ? dealsRes.value     : []
  const allTasks  = tasksRes.status     === 'fulfilled' ? tasksRes.value     : []
  const prospects = prospectsRes.status === 'fulfilled' ? prospectsRes.value : []

  const funnel    = buildFunnel(deals)
  const leads     = buildLeadCounts(deals)
  const openTasks = allTasks.filter(t => t.status === 'Open')

  // Prospect DB health — group by Lvl 1 Source
  const totalStock = prospects.length
  const totalWeeks = totalStock / WEEKLY_CALL_CAPACITY

  const sourceMap = new Map<string, number>()
  for (const p of prospects) {
    const src = p.lvl1Source?.trim() || 'Unknown'
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1)
  }
  const sourceBreakdown = Array.from(sourceMap.entries())
    .map(([source, count]) => ({ source, count, weeks: count / WEEKLY_CALL_CAPACITY }))
    .sort((a, b) => b.count - a.count)

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

          {totalStock === 0 ? (
            <p className="text-mh-muted text-sm italic">No prospects in stock — upload to the Prospects tab.</p>
          ) : (
            <>
              {/* Headline numbers */}
              <div className="flex items-end gap-4 mb-4">
                <div>
                  <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Total Stock</p>
                  <p className="text-3xl font-semibold text-mh-text mt-0.5">{totalStock.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Weeks Remaining</p>
                  <p className={`text-3xl font-semibold mt-0.5 ${totalWeeks < 2 ? 'text-red-500' : totalWeeks < 4 ? 'text-mh-gold' : 'text-mh-text'}`}>
                    {totalWeeks.toFixed(1)}w
                  </p>
                </div>
              </div>

              {/* Per-source breakdown */}
              <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-2">By Source</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {sourceBreakdown.map(({ source, count, weeks }) => (
                  <div key={source} className="flex items-center justify-between py-1 border-b border-mh-border last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {weeks < 2 && <span className="text-red-500 text-xs">⚠</span>}
                      <span className="text-xs text-mh-text truncate">{source}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="text-xs text-mh-muted">{count.toLocaleString()}</span>
                      <span className={`text-xs font-medium ${weeks < 2 ? 'text-red-500' : weeks < 4 ? 'text-mh-gold' : 'text-mh-muted'}`}>
                        {weeks.toFixed(1)}w
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {sourceBreakdown.some(s => s.weeks < 2) && (
                <p className="text-xs text-red-500 mt-3">
                  ⚠ One or more sources below 2-week threshold — upload more prospects.
                </p>
              )}
            </>
          )}
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
