import type { FunnelStage } from '@/lib/types'

export default function FunnelColumn({ stages }: { stages: FunnelStage[] }) {
  if (stages.length === 0) {
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
    </div>
  )
}
