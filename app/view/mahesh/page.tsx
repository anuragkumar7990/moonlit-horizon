import { getCalls, getMeetings, getTargets } from '@/lib/sheets'
import { getDeals } from '@/lib/zoho'
import { buildCallsData, buildMeetingsData, buildFunnel, buildLeadCounts } from '@/lib/dashboard'
import PersonSelector from '@/components/PersonSelector'
import FunnelColumn from '@/components/FunnelColumn'

export const revalidate = 60

export default async function MaheshPage() {
  const [callsRes, meetingsRes, dealsRes, targetsRes] = await Promise.allSettled([
    getCalls(),
    getMeetings(),
    getDeals(),
    getTargets(),
  ])

  const calls    = callsRes.status    === 'fulfilled' ? callsRes.value    : []
  const meetings = meetingsRes.status === 'fulfilled' ? meetingsRes.value : []
  const deals    = dealsRes.status    === 'fulfilled' ? dealsRes.value    : []
  const targets  = targetsRes.status  === 'fulfilled' ? targetsRes.value  : []

  const callsData    = buildCallsData(calls, meetings, targets)
  const meetingsData = buildMeetingsData(meetings, targets)
  const funnel       = buildFunnel(deals)
  const leads        = buildLeadCounts(deals)

  const weekCalls = callsData.weekly
  const weekMtgs  = meetingsData.weekly

  const pipelineCount  = funnel.stages.reduce((sum, s) => sum + s.count,  0)
  const pipelineAmount = funnel.stages.reduce((sum, s) => sum + s.amount, 0)

  const weekStats = [
    { label: 'Dialled',      val: weekCalls.dialled        },
    { label: 'Connected',    val: weekCalls.connected       },
    { label: 'Mtgs Booked',  val: weekCalls.meetingsBooked  },
    { label: 'L1 Booked',    val: weekMtgs.l1Booked        },
    { label: 'L1 Conducted', val: weekMtgs.l1Conducted     },
    { label: 'L2 Conducted', val: weekMtgs.l2Conducted     },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <PersonSelector />
      </div>

      {/* Hero metrics */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="card text-center">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-2">Won</p>
          <p className="text-4xl font-semibold text-mh-gold">{funnel.won.count}</p>
          {funnel.won.amount > 0 && (
            <p className="text-xs text-mh-muted mt-1">₹{funnel.won.amount.toLocaleString('en-IN')}</p>
          )}
        </div>
        <div className="card text-center">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-2">Active Pipeline</p>
          <p className="text-4xl font-semibold text-mh-text">{pipelineCount}</p>
          <p className="text-xs text-mh-muted mt-1">deals</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-2">Pipeline Value</p>
          <p className="text-4xl font-semibold text-mh-text">
            {pipelineAmount >= 100000
              ? `₹${(pipelineAmount / 100000).toFixed(1)}L`
              : `₹${pipelineAmount.toLocaleString('en-IN')}`}
          </p>
        </div>
      </div>

      {/* Funnel + This week */}
      <div className="grid grid-cols-[240px_1fr] gap-4 mb-4">
        <div className="card">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-4">Pipeline</p>
          <FunnelColumn data={funnel} />
        </div>

        <div className="card">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-4">This Week</p>
          <div className="grid grid-cols-3 gap-6">
            {weekStats.map(item => (
              <div key={item.label}>
                <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest">{item.label}</p>
                <p className="text-3xl font-semibold text-mh-text mt-1">{item.val}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-mh-border mt-5 pt-4">
            <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">Leads</p>
            <div className="flex gap-8">
              {[
                { label: 'Hot',   val: leads.hot,   color: 'text-mh-vermillion' },
                { label: 'Warm',  val: leads.warm,  color: 'text-mh-gold'       },
                { label: 'Cold',  val: leads.cold,  color: 'text-mh-muted'      },
                { label: 'Total', val: leads.total, color: 'text-mh-muted'      },
              ].map(item => (
                <div key={item.label}>
                  <p className={`text-[10px] font-semibold uppercase tracking-widest ${item.color}`}>{item.label}</p>
                  <p className="text-2xl font-semibold text-mh-text mt-0.5">{item.val}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary + Reports */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">Weekly Summary</p>
          <p className="text-mh-muted text-sm italic leading-relaxed">
            LLM-generated summary arrives in Phase 2 — covers target deviations,
            what went well, what didn&apos;t, payment status, and next week&apos;s priorities.
            Posted to <span className="text-mh-text">#stats</span> every Monday 9am IST.
          </p>
        </div>
        <div className="card">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">Reports</p>
          <div className="space-y-2">
            <p className="text-sm text-mh-muted italic">Weekly PDF — auto-generated every Sunday</p>
            <p className="text-sm text-mh-muted italic">Monthly PDF — auto-generated on the 1st</p>
            <p className="text-xs text-mh-muted mt-3">
              Download links will appear here once report generation is live (Phase 2).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
