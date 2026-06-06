import { getDeals } from '@/lib/zoho'
import { getTasks, getProspects, getTrainerPipeline, getTrainerRoster, getTopicCoverage, getObjectives } from '@/lib/sheets'
import { buildFunnel, buildLeadCounts } from '@/lib/dashboard'
import PersonSelector from '@/components/PersonSelector'
import FunnelColumn from '@/components/FunnelColumn'

export const revalidate = 60

const WEEKLY_CALL_CAPACITY = 250

function istPeriod(): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}`
}

export default async function AshutoshPage() {
  const [dealsRes, tasksRes, prospectsRes, pipelineRes, rosterRes, coverageRes, objectivesRes] = await Promise.allSettled([
    getDeals(), getTasks(), getProspects(), getTrainerPipeline(), getTrainerRoster(), getTopicCoverage(),
    getObjectives(istPeriod()),
  ])
  const deals    = dealsRes.status    === 'fulfilled' ? dealsRes.value    : []
  const allTasks = tasksRes.status    === 'fulfilled' ? tasksRes.value    : []
  const prospects = prospectsRes.status === 'fulfilled' ? prospectsRes.value : []
  const pipeline  = pipelineRes.status  === 'fulfilled' ? pipelineRes.value  : {
    outreachTotal: 0, connected: 0, formFilled: 0, emailSent: 0,
    whatsappSent: 0, meetingBooked: 0, meetingConducted: 0, sampleTaken: 0, onboarded: 0,
  }
  const roster     = rosterRes.status     === 'fulfilled' ? rosterRes.value     : []
  const coverage   = coverageRes.status   === 'fulfilled' ? coverageRes.value   : []
  const objectives = objectivesRes.status === 'fulfilled' ? objectivesRes.value : []

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

  // Trainer roster stats
  const tier1Count = roster.filter(t => t.tier === 'Tier-1').length
  const tier2Count = roster.filter(t => t.tier === 'Tier-2').length
  const tier3Count = roster.filter(t => t.tier === 'Tier-3').length
  const topTrainers = [...roster].sort((a, b) => b.score - a.score).slice(0, 8)

  // Build a name→tier map for the topic coverage best-tier lookup
  const trainerTierMap = new Map(roster.map(t => [t.name, t.tier]))

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

      {/* Row 3: Objectives */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Objective Progress</p>
          <a
            href="/api/reports/monthly"
            target="_blank"
            className="text-[10px] text-mh-muted hover:text-mh-text transition-colors border border-mh-border hover:border-mh-vermillion rounded px-2 py-1"
          >
            Monthly PDF ↗
          </a>
        </div>
        {objectives.length === 0 ? (
          <p className="text-mh-muted text-sm italic">
            No objectives set for this month. Use{' '}
            <span className="text-mh-text font-medium">/mh objective set</span> in Discord to add targets.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            {objectives.map(obj => {
              const pct = obj.target > 0 ? Math.min(100, Math.round((obj.current / obj.target) * 100)) : 0
              const barColor = pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-mh-gold' : 'bg-mh-vermillion'
              const textColor = pct >= 100 ? 'text-green-400' : pct >= 70 ? 'text-mh-gold' : 'text-mh-vermillion'
              return (
                <div key={obj.objective}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-mh-text">{obj.objective}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-mh-muted tabular-nums">
                        {obj.current}{obj.target > 0 ? ` / ${obj.target}` : ''}
                      </span>
                      {obj.target > 0 && (
                        <span className={`text-[10px] font-semibold tabular-nums ${textColor}`}>{pct}%</span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 bg-mh-surface2 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  {obj.assignedTo && (
                    <p className="text-[10px] text-mh-muted mt-0.5">{obj.assignedTo}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Row 4: Trainer Supply */}
      <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">Trainer Supply</p>
      <div className="grid grid-cols-[200px_220px_1fr] gap-4">

        {/* Outreach Pipeline */}
        <div className="card">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">Outreach Pipeline</p>
          <div className="flex items-end gap-4 mb-4">
            <div>
              <p className="text-[10px] text-mh-muted uppercase tracking-widest">Prospects</p>
              <p className="text-2xl font-semibold text-mh-text mt-0.5">{pipeline.outreachTotal}</p>
            </div>
            <div>
              <p className="text-[10px] text-mh-muted uppercase tracking-widest">Connected</p>
              <p className="text-2xl font-semibold text-mh-text mt-0.5">{pipeline.connected}</p>
            </div>
          </div>
          <div className="border-t border-mh-border pt-3 space-y-2">
            {([
              ['Form Filled',     pipeline.formFilled],
              ['Email Sent',      pipeline.emailSent],
              ['WhatsApp Sent',   pipeline.whatsappSent],
              ['Meeting Booked',  pipeline.meetingBooked],
              ['Conducted',       pipeline.meetingConducted],
              ['Sample Taken',    pipeline.sampleTaken],
              ['Onboarded',       pipeline.onboarded],
            ] as [string, number][]).map(([label, val]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-mh-muted">{label}</span>
                <span className={`text-xs font-semibold tabular-nums ${val > 0 ? 'text-mh-text' : 'text-mh-border'}`}>
                  {val}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Trainer Roster */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Trainer Roster</p>
            <span className="text-[10px] text-mh-muted">{roster.length} scored</span>
          </div>

          {/* Tier breakdown bars */}
          <div className="space-y-2 mb-4">
            {([
              ['Tier-1', tier1Count, 'text-mh-gold',       'bg-mh-gold'],
              ['Tier-2', tier2Count, 'text-mh-vermillion', 'bg-mh-vermillion'],
              ['Tier-3', tier3Count, 'text-mh-muted',      'bg-mh-muted'],
            ] as [string, number, string, string][]).map(([tier, count, textCls, barCls]) => (
              <div key={tier} className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold w-12 shrink-0 ${textCls}`}>{tier}</span>
                <div className="flex-1 h-1.5 bg-mh-surface2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barCls}`}
                    style={{ width: roster.length ? `${(count / roster.length) * 100}%` : '0%' }}
                  />
                </div>
                <span className="text-xs text-mh-text w-4 text-right shrink-0">{count}</span>
              </div>
            ))}
          </div>

          {/* Top trainers by score */}
          <div className="border-t border-mh-border pt-3 space-y-2 max-h-52 overflow-y-auto">
            {topTrainers.map(t => (
              <div key={t.name} className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-mh-text leading-tight">{t.name}</p>
                  {t.skills.length > 0 && (
                    <p className="text-[10px] text-mh-muted truncate">{t.skills.slice(0, 2).join(' · ')}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-semibold ${
                    t.tier === 'Tier-1' ? 'text-mh-gold' : t.tier === 'Tier-2' ? 'text-mh-vermillion' : 'text-mh-muted'
                  }`}>{t.tier}</span>
                  <span className="text-[10px] text-mh-border">{t.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Topic Coverage */}
        <div className="card">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">Topic Coverage</p>
          {coverage.length === 0 ? (
            <p className="text-mh-muted text-sm italic">No topic data available.</p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
              {coverage.map(t => {
                const bestTier = t.trainers.length === 0
                  ? null
                  : trainerTierMap.get(t.trainers[0]) ?? null
                return (
                  <div key={t.topic} className="flex items-center justify-between py-1.5 border-b border-mh-border last:border-0">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs text-mh-text">{t.topic}</span>
                      <span className="text-[10px] text-mh-muted ml-2">{t.category}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      {t.trainers.length === 0 ? (
                        <span className="text-[10px] text-red-500 font-semibold">⚠ No trainers</span>
                      ) : (
                        <>
                          <span className="text-[10px] text-mh-muted">{t.trainers.length}T</span>
                          {bestTier && (
                            <span className={`text-[10px] font-semibold w-12 text-right ${
                              bestTier === 'Tier-1' ? 'text-mh-gold' : bestTier === 'Tier-2' ? 'text-mh-vermillion' : 'text-mh-muted'
                            }`}>{bestTier}</span>
                          )}
                          {t.tier1Price > 0 && (
                            <span className="text-[10px] text-mh-muted w-14 text-right">
                              ₹{(t.tier1Price / 1000).toFixed(0)}k/hr
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
