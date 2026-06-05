import type { FunnelData } from '@/lib/types'

export default function FunnelColumn({ data }: { data: FunnelData }) {
  const { stages, won, lost } = data

  if (stages.length === 0 && won.count === 0 && lost.count === 0) {
    return <p className="text-mh-muted text-sm">No active deals</p>
  }

  const maxCount = Math.max(...stages.map(s => s.count), 1)

  return (
    <div className="space-y-2.5">
      {stages.map(s => (
        <div key={s.stage}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-mh-muted truncate max-w-[130px]">{s.stage}</span>
            <span className="text-[11px] font-semibold text-mh-text ml-2 shrink-0">{s.count}</span>
          </div>
          <div className="h-1.5 bg-mh-surface2 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-mh-vermillion transition-all duration-500"
              style={{ width: `${(s.count / maxCount) * 100}%` }}
            />
          </div>
          {s.amount > 0 && (
            <p className="text-[10px] text-mh-muted mt-0.5">
              ₹{s.amount.toLocaleString('en-IN')}
            </p>
          )}
        </div>
      ))}

      {/* Won + Lost */}
      <div className="border-t border-mh-border pt-3 flex gap-2">
        <button
          title="Won deals — full table coming soon"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-mh-surface2 border border-mh-border
            hover:border-mh-gold hover:bg-[#1a1a0e] transition-all group cursor-pointer"
        >
          <span className="text-base leading-none">🏆</span>
          <div className="text-left">
            <p className="text-[10px] text-mh-muted leading-none mb-0.5">Won</p>
            <p className="text-sm font-semibold text-mh-gold leading-none">{won.count}</p>
          </div>
        </button>

        <button
          title="Lost deals — full table coming soon"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-mh-surface2 border border-mh-border
            hover:border-mh-negative hover:bg-[#1a0a0a] transition-all group cursor-pointer"
        >
          <span className="text-base leading-none">👎</span>
          <div className="text-left">
            <p className="text-[10px] text-mh-muted leading-none mb-0.5">Lost</p>
            <p className="text-sm font-semibold text-mh-negative leading-none">{lost.count}</p>
          </div>
        </button>
      </div>
    </div>
  )
}
