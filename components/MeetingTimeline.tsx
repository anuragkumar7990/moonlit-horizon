import type { Meeting } from '@/lib/types'
import { format, parseISO, isPast } from 'date-fns'

function formatDateTime(dateStr: string) {
  try { return format(parseISO(dateStr), 'dd MMM yyyy, h:mm a') }
  catch { return dateStr }
}

export default function MeetingTimeline({ meetings }: { meetings: Meeting[] }) {
  if (meetings.length === 0) {
    return <p className="text-sm text-slate-400 py-4 text-center">No meetings recorded yet.</p>
  }

  const sorted = [...meetings].sort(
    (a, b) => new Date(b.meetingTime).getTime() - new Date(a.meetingTime).getTime()
  )

  return (
    <div className="space-y-3">
      {sorted.map((m) => {
        const past = isPast(new Date(m.meetingTime))
        return (
          <div key={m.meetingId} className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${past ? 'bg-slate-300' : 'bg-blue-500'}`} />
              <div className="w-px bg-slate-200 flex-1 mt-1" />
            </div>
            <div className="pb-4 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-800">{formatDateTime(m.meetingTime)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.meetingType === 'L1' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>
                  {m.meetingType}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${past ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-700'}`}>
                  {past ? 'Done' : 'Upcoming'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{m.contactName} · {m.contactEmail}</p>
              {m.gMeetLink && (
                <a href={m.gMeetLink} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mt-0.5 block">
                  Join G-Meet →
                </a>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
