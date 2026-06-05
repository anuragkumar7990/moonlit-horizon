import type { Note } from '@/lib/types'
import { format, parseISO } from 'date-fns'

function formatDate(dateStr: string) {
  try { return format(parseISO(dateStr), 'dd MMM yyyy') }
  catch { return dateStr }
}

export default function NotesPanel({ notes }: { notes: Note[] }) {
  if (notes.length === 0) {
    return <p className="text-sm text-slate-400 py-4 text-center">No meeting notes yet. Notes appear automatically after a meeting ends.</p>
  }

  const sorted = [...notes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <div className="space-y-4">
      {sorted.map((note, i) => (
        <div key={note.meetingId || i} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <p className="text-xs text-slate-400 mb-2">{formatDate(note.createdAt)}</p>

          <div className="mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Summary</p>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{note.summary}</p>
          </div>

          {note.actionables && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Actionables</p>
              <ul className="space-y-1">
                {note.actionables.split('\n').filter(Boolean).map((item, j) => (
                  <li key={j} className="flex gap-2 text-sm text-slate-700">
                    <span className="text-amber-500 shrink-0">•</span>
                    <span>{item.replace(/^[-•*]\s*/, '')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
