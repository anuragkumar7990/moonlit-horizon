'use client'
import { useState, useEffect } from 'react'
import type { Task } from '@/lib/types'

const ASSIGNEE_COLOR: Record<string, string> = {
  Anurag:   '#E8341C',
  Tanishq:  '#60A5FA',
  Ashutosh: '#A78BFA',
  Mahesh:   '#22C55E',
}

const CATEGORY_LABEL: Record<string, string> = {
  'no-notes':        'No Notes',
  'overdue-closing': 'Overdue',
  'overdue-callback':'Callback',
  'stale-deal':      'Stale Deal',
  'ci-followup':     'CI Follow-up',
  'other':           'Other',
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-mh-vermillion border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function P0TasksModule() {
  const [tasks, setTasks]     = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'open' | 'all'>('open')
  const [marking, setMarking] = useState<string | null>(null)

  async function loadTasks() {
    try {
      const r = await fetch('/api/tasks?type=P0')
      const d = await r.json() as { tasks?: Task[] }
      setTasks(d.tasks ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTasks() }, [])

  async function markDone(linkedDeal: string) {
    setMarking(linkedDeal)
    try {
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedDeal, status: 'Done' }),
      })
      setTasks(prev =>
        prev.map(t =>
          t.linkedDeal === linkedDeal
            ? { ...t, status: 'Done', completedAt: new Date().toISOString().slice(0, 16) }
            : t
        )
      )
    } finally {
      setMarking(null)
    }
  }

  const openCount = tasks.filter(t => t.status === 'Open').length
  const visible   = filter === 'open' ? tasks.filter(t => t.status === 'Open') : tasks

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="card flex flex-wrap items-center gap-3">
        <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mr-auto">
          P0 Tasks
        </p>
        {(['open', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded-full transition-all border ${
              filter === f
                ? 'bg-mh-vermillion/20 text-mh-vermillion border-mh-vermillion/40'
                : 'text-mh-muted border-transparent hover:text-white'
            }`}
          >
            {f === 'open' ? `Open (${openCount})` : `All (${tasks.length})`}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="card text-mh-muted text-sm text-center py-10">
          {filter === 'open' ? 'No open P0 tasks — all clear.' : 'No tasks found.'}
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Date', 'Task', 'Assigned To', 'Status', ''].map(h => (
                  <th
                    key={h}
                    className="text-left text-[10px] font-semibold text-mh-muted uppercase tracking-widest px-4 py-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((t, i) => (
                <tr
                  key={i}
                  className="hover:bg-white/[0.02] transition-colors"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <td className="px-4 py-3 text-mh-muted text-xs whitespace-nowrap align-top">{t.date}</td>
                  <td className="px-4 py-3 text-mh-text align-top max-w-sm">
                    <p className="leading-snug">{t.task}</p>
                    {t.linkedDeal.startsWith('deal:') || t.linkedDeal.startsWith('ci:') || t.linkedDeal.startsWith('meeting:') || t.linkedDeal.startsWith('callback:') ? (
                      <p className="text-[10px] text-mh-muted mt-0.5">
                        {CATEGORY_LABEL[
                          t.linkedDeal.startsWith('meeting:') ? 'no-notes' :
                          t.linkedDeal.startsWith('callback:') ? 'overdue-callback' :
                          t.linkedDeal.includes(':stale') ? 'stale-deal' :
                          t.linkedDeal.includes(':overdue') ? 'overdue-closing' :
                          t.linkedDeal.startsWith('ci:') ? 'ci-followup' : 'other'
                        ] ?? ''}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap align-top">
                    <span
                      className="text-xs font-medium"
                      style={{ color: ASSIGNEE_COLOR[t.assignedTo] ?? '#9CA3AF' }}
                    >
                      {t.assignedTo}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap align-top">
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        t.status === 'Done'
                          ? 'text-green-400 bg-green-400/10'
                          : 'text-yellow-400 bg-yellow-400/10'
                      }`}
                    >
                      {t.status}
                    </span>
                    {t.status === 'Done' && t.completedAt && (
                      <p className="text-[10px] text-mh-muted mt-0.5">{t.completedAt.slice(0, 10)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {t.status === 'Open' && (
                      <button
                        onClick={() => markDone(t.linkedDeal)}
                        disabled={marking === t.linkedDeal}
                        className="text-[11px] px-3 py-1 rounded border border-green-500/30 text-green-400 hover:bg-green-400/10 transition-all disabled:opacity-50 whitespace-nowrap"
                      >
                        {marking === t.linkedDeal ? '…' : 'Mark Done'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
