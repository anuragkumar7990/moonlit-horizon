'use client'
import { useState, useEffect } from 'react'
import type { Task } from '@/lib/types'

const ASSIGNEES = ['Anurag', 'Tanishq', 'Ashutosh', 'Mahesh'] as const
type Assignee = (typeof ASSIGNEES)[number]

const ASSIGNEE_COLOR: Record<string, string> = {
  Anurag:   '#E8341C',
  Tanishq:  '#60A5FA',
  Ashutosh: '#A78BFA',
  Mahesh:   '#22C55E',
}

function categoryLabel(linkedDeal: string): string {
  if (linkedDeal.startsWith('meeting:'))   return 'No Notes'
  if (linkedDeal.startsWith('callback:'))  return 'Callback'
  if (linkedDeal.includes(':overdue'))      return 'Overdue'
  if (linkedDeal.includes(':stale'))        return 'Stale Deal'
  if (linkedDeal.startsWith('ci:'))         return 'CI Follow-up'
  if (linkedDeal.startsWith('other:'))      return 'Manual'
  return ''
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-mh-vermillion border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ── Add / Edit modal ──────────────────────────────────────────────────────────

interface ModalProps {
  initial?: { task: string; assignedTo: string; linkedDeal: string }
  onClose: () => void
  onSaved: (task: Task | null) => void
}

function TaskModal({ initial, onClose, onSaved }: ModalProps) {
  const isEdit = !!initial?.linkedDeal && !initial.linkedDeal.startsWith('other:new')
  const [taskText, setTaskText]     = useState(initial?.task ?? '')
  const [assignedTo, setAssignedTo] = useState<string>(initial?.assignedTo ?? 'Anurag')
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState('')

  async function handleSave() {
    if (!taskText.trim()) { setErr('Task text is required'); return }
    setSaving(true)
    setErr('')
    try {
      if (isEdit && initial?.linkedDeal) {
        await fetch('/api/tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ linkedDeal: initial.linkedDeal, task: taskText.trim(), assignedTo }),
        })
        onSaved(null) // caller will reload
      } else {
        const res = await fetch('/api/p0-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task: taskText.trim(), assignedTo }),
        })
        const data = await res.json() as { ok?: boolean; error?: string }
        if (!data.ok) throw new Error(data.error ?? 'Unknown error')
        onSaved(null) // caller will reload
      }
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-xl p-6 shadow-2xl"
        style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-4">
          {isEdit ? 'Edit Task' : 'Add P0 Task'}
        </p>

        <label className="block text-xs text-mh-muted mb-1">Task</label>
        <textarea
          autoFocus
          rows={3}
          value={taskText}
          onChange={e => setTaskText(e.target.value)}
          placeholder="Describe the task…"
          className="w-full text-sm bg-transparent border border-mh-border rounded px-3 py-2 text-mh-text placeholder:text-mh-muted focus:outline-none focus:border-mh-vermillion/50 resize-none mb-4"
        />

        <label className="block text-xs text-mh-muted mb-1">Assigned To</label>
        <div className="flex gap-2 mb-5">
          {ASSIGNEES.map(a => (
            <button
              key={a}
              onClick={() => setAssignedTo(a)}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                assignedTo === a
                  ? 'border-current font-semibold'
                  : 'border-transparent text-mh-muted hover:text-white'
              }`}
              style={assignedTo === a ? { color: ASSIGNEE_COLOR[a], background: `${ASSIGNEE_COLOR[a]}18`, borderColor: `${ASSIGNEE_COLOR[a]}40` } : undefined}
            >
              {a}
            </button>
          ))}
        </div>

        {err && <p className="text-xs text-red-400 mb-3">{err}</p>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="text-xs px-4 py-2 text-mh-muted hover:text-white transition-all">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs px-5 py-2 rounded bg-mh-vermillion/20 border border-mh-vermillion/40 text-mh-vermillion hover:bg-mh-vermillion/30 transition-all disabled:opacity-50"
          >
            {saving ? 'Saving…' : isEdit ? 'Save' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main module ───────────────────────────────────────────────────────────────

export default function P0TasksModule() {
  const [tasks, setTasks]     = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'open' | 'all'>('open')
  const [marking, setMarking] = useState<string | null>(null)
  const [modal, setModal]     = useState<{ initial?: { task: string; assignedTo: string; linkedDeal: string } } | null>(null)

  async function loadTasks() {
    setLoading(true)
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
      setTasks(prev => prev.map(t => t.linkedDeal === linkedDeal ? { ...t, status: 'Done' } : t))
    } finally {
      setMarking(null)
    }
  }

  function openEdit(t: Task) {
    setModal({ initial: { task: t.task, assignedTo: t.assignedTo, linkedDeal: t.linkedDeal } })
  }

  const openCount = tasks.filter(t => t.status === 'Open').length
  const visible   = filter === 'open' ? tasks.filter(t => t.status === 'Open') : tasks

  if (loading) return <Spinner />

  return (
    <>
      {modal && (
        <TaskModal
          initial={modal.initial}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); loadTasks() }}
        />
      )}

      <div className="space-y-4">
        <div className="card flex flex-wrap items-center gap-3">
          <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest">P0 Tasks</p>
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
          <button
            onClick={() => setModal({})}
            className="ml-auto text-xs px-4 py-1.5 rounded border border-mh-vermillion/40 bg-mh-vermillion/10 text-mh-vermillion hover:bg-mh-vermillion/20 transition-all"
          >
            + Add Task
          </button>
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
                    <th key={h} className="text-left text-[10px] font-semibold text-mh-muted uppercase tracking-widest px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((t, i) => {
                  const cat = categoryLabel(t.linkedDeal)
                  return (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-4 py-3 text-mh-muted text-xs whitespace-nowrap align-top">{t.date}</td>
                      <td className="px-4 py-3 text-mh-text align-top max-w-sm">
                        <p className="leading-snug">{t.task}</p>
                        {cat && <p className="text-[10px] text-mh-muted mt-0.5">{cat}</p>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap align-top">
                        <span className="text-xs font-medium" style={{ color: ASSIGNEE_COLOR[t.assignedTo] ?? '#9CA3AF' }}>{t.assignedTo}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap align-top">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${t.status === 'Done' ? 'text-green-400 bg-green-400/10' : 'text-yellow-400 bg-yellow-400/10'}`}>
                          {t.status}
                        </span>
                        {t.status === 'Done' && t.completedAt && (
                          <p className="text-[10px] text-mh-muted mt-0.5">{t.completedAt.slice(0, 10)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(t)}
                            className="text-[11px] px-2.5 py-1 rounded border border-white/10 text-mh-muted hover:text-white hover:border-white/25 transition-all"
                          >
                            Edit
                          </button>
                          {t.status === 'Open' && (
                            <button
                              onClick={() => markDone(t.linkedDeal)}
                              disabled={marking === t.linkedDeal}
                              className="text-[11px] px-3 py-1 rounded border border-green-500/30 text-green-400 hover:bg-green-400/10 transition-all disabled:opacity-50 whitespace-nowrap"
                            >
                              {marking === t.linkedDeal ? '…' : 'Mark Done'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
