import type { Communication } from '@/lib/types'
import { format, parseISO } from 'date-fns'

function formatTime(ts: string) {
  try { return format(parseISO(ts), 'dd MMM, h:mm a') }
  catch { return ts }
}

const SOURCE_STYLES = {
  Discord: { bg: 'bg-indigo-100', text: 'text-indigo-700', icon: '💬' },
  Gmail: { bg: 'bg-red-100', text: 'text-red-700', icon: '✉️' },
}

export default function CommsTimeline({ comms }: { comms: Communication[] }) {
  if (comms.length === 0) {
    return (
      <p className="text-sm text-slate-400 py-4 text-center">
        No communications tracked yet. Discord messages and Gmail threads will appear here automatically.
      </p>
    )
  }

  const sorted = [...comms].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return (
    <div className="space-y-2">
      {sorted.map((c) => {
        const style = SOURCE_STYLES[c.source] ?? SOURCE_STYLES.Discord
        return (
          <div key={c.threadId} className="flex gap-3 py-2 border-b border-slate-100 last:border-0">
            <span className="text-base shrink-0 mt-0.5">{style.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                  {c.source}
                </span>
                <span className="text-xs text-slate-400">{formatTime(c.timestamp)}</span>
              </div>
              <p className="text-sm text-slate-700 truncate">{c.messagePreview}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
