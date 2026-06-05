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
            hover:border-mh-gold hover:bg-[#1a1a0e] transition-all cursor-pointer"
        >
          {/* trophy */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#FFD700" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 15c-3.31 0-6-2.69-6-6V3h12v6c0 3.31-2.69 6-6 6zm0 2c1.1 0 2 .9 2 2v1H10v-1c0-1.1.9-2 2-2zM7 20h10v2H7v-2zM4 3H2v4c0 1.65 1.35 3 3 3V3zm16 0h-2v7c1.65 0 3-1.35 3-3V3h-1z"/>
          </svg>
          <div className="text-left">
            <p className="text-[10px] text-mh-muted leading-none mb-0.5">Won</p>
            <p className="text-sm font-semibold text-mh-gold leading-none">{won.count}</p>
          </div>
        </button>

        <button
          title="Lost deals — full table coming soon"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-mh-surface2 border border-mh-border
            hover:border-mh-negative hover:bg-[#1a0a0a] transition-all cursor-pointer"
        >
          {/* thumbs down */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF4444" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/>
          </svg>
          <div className="text-left">
            <p className="text-[10px] text-mh-muted leading-none mb-0.5">Lost</p>
            <p className="text-sm font-semibold text-mh-negative leading-none">{lost.count}</p>
          </div>
        </button>
      </div>
    </div>
  )
}
