'use client'
import { useState, useEffect } from 'react'

interface ShortTermGoal {
  id: string
  title: string
  targetValue: number
  currentValue: number
  dueDate: string
  status: string
}

interface LongTermGoal {
  id: string
  title: string
  description: string
  startDate: string
  targetDate: string
  owner: string
  percentComplete: number
}

interface GoalTask {
  id: string
  goalId: string
  task: string
  assignee: string
  dueDate: string
  status: string
  percentDone: number
}

interface GoalsData {
  shortTerm: ShortTermGoal[]
  longTerm: LongTermGoal[]
  tasks: GoalTask[]
}

function GaugeBar({ current, target, color = '#E8341C' }: { current: number; target: number; color?: string }) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0
  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: pct >= 100 ? '#22C55E' : color }}
      />
    </div>
  )
}

function AddShortTermModal({ onAdd, onClose }: { onAdd: (title: string, target: number, due: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [due, setDue] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-sm mx-4 space-y-3">
        <p className="text-sm font-semibold text-mh-text">Add Short-term Goal</p>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Goal title" className="w-full bg-mh-card border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text placeholder:text-mh-muted outline-none focus:border-mh-vermillion/50" />
        <div className="flex gap-2">
          <input value={target} onChange={e => setTarget(e.target.value)} placeholder="Target value" type="number" className="flex-1 bg-mh-card border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text placeholder:text-mh-muted outline-none" />
          <input value={due} onChange={e => setDue(e.target.value)} type="date" className="flex-1 bg-mh-card border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text outline-none" />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-mh-muted">Cancel</button>
          <button onClick={() => { if (title) onAdd(title, Number(target) || 0, due); onClose() }} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #E8341C, #FF5A3A)' }}>Add</button>
        </div>
      </div>
    </div>
  )
}

function AddLongTermModal({ onAdd, onClose }: { onAdd: (title: string, desc: string, target: string, owner: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [owner, setOwner] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-sm mx-4 space-y-3">
        <p className="text-sm font-semibold text-mh-text">Add Long-term Goal</p>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Goal title" className="w-full bg-mh-card border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text placeholder:text-mh-muted outline-none focus:border-mh-vermillion/50" />
        <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full bg-mh-card border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text placeholder:text-mh-muted resize-none outline-none" />
        <div className="flex gap-2">
          <input value={targetDate} onChange={e => setTargetDate(e.target.value)} type="date" className="flex-1 bg-mh-card border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text outline-none" />
          <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Owner" className="flex-1 bg-mh-card border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text placeholder:text-mh-muted outline-none" />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-mh-muted">Cancel</button>
          <button onClick={() => { if (title) onAdd(title, desc, targetDate, owner); onClose() }} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #E8341C, #FF5A3A)' }}>Add</button>
        </div>
      </div>
    </div>
  )
}

function AddTaskModal({ goalId, onAdd, onClose }: { goalId: string; onAdd: (goalId: string, task: string, assignee: string, due: string) => void; onClose: () => void }) {
  const [task, setTask] = useState('')
  const [assignee, setAssignee] = useState('')
  const [due, setDue] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-sm mx-4 space-y-3">
        <p className="text-sm font-semibold text-mh-text">Add Task</p>
        <input value={task} onChange={e => setTask(e.target.value)} placeholder="Task description" className="w-full bg-mh-card border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text placeholder:text-mh-muted outline-none focus:border-mh-vermillion/50" />
        <div className="flex gap-2">
          <input value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="Assignee" className="flex-1 bg-mh-card border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text placeholder:text-mh-muted outline-none" />
          <input value={due} onChange={e => setDue(e.target.value)} type="date" className="flex-1 bg-mh-card border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text outline-none" />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-mh-muted">Cancel</button>
          <button onClick={() => { if (task) onAdd(goalId, task, assignee, due); onClose() }} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #E8341C, #FF5A3A)' }}>Add</button>
        </div>
      </div>
    </div>
  )
}

export default function ObjectivesModule() {
  const [data, setData] = useState<GoalsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [addShortModal, setAddShortModal] = useState(false)
  const [addLongModal, setAddLongModal] = useState(false)
  const [addTaskModal, setAddTaskModal] = useState<string | null>(null)
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null)
  const [editingPct, setEditingPct] = useState<{ id: string; type: 'short' | 'long' | 'task'; field: string } | null>(null)
  const [editVal, setEditVal] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/goals')
      setData(await res.json() as GoalsData)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function addGoal(type: 'short' | 'long', payload: Record<string, string | number>) {
    await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data: payload }),
    })
    await load()
  }

  async function addTask(goalId: string, task: string, assignee: string, dueDate: string) {
    await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'task', data: { goalId, task, assignee, dueDate } }),
    })
    await load()
  }

  async function updateField(type: 'short' | 'long' | 'task', id: string, field: string, value: string | number) {
    await fetch('/api/goals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id, field, value }),
    })
    await load()
  }

  async function deleteGoal(type: 'short' | 'long' | 'task', id: string) {
    await fetch('/api/goals', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id }),
    })
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-mh-vermillion border-t-transparent animate-spin" />
      </div>
    )
  }

  const tasksFor = (goalId: string) => (data?.tasks ?? []).filter(t => t.goalId === goalId)

  return (
    <div className="grid grid-cols-2 gap-4">

      {/* Left: Short-term Goals */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Short-term Goals</p>
          <button onClick={() => setAddShortModal(true)} className="text-xs text-mh-vermillion hover:text-red-400">+ Add</button>
        </div>

        {(data?.shortTerm ?? []).length === 0 && (
          <p className="text-mh-muted text-sm italic card py-6 text-center">No short-term goals yet.</p>
        )}

        {(data?.shortTerm ?? []).map(g => {
          const pct = g.targetValue > 0 ? Math.min(Math.round((g.currentValue / g.targetValue) * 100), 100) : 0
          return (
            <div key={g.id} className="card space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-mh-text">{g.title}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${g.status === 'Done' ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-mh-muted'}`}>{g.status}</span>
                  <button onClick={() => deleteGoal('short', g.id)} className="text-mh-muted/40 hover:text-red-400 text-xs">×</button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <GaugeBar current={g.currentValue} target={g.targetValue} />
                <span className="text-xs text-mh-muted shrink-0">{pct}%</span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-mh-muted">
                <span>
                  {editingPct?.id === g.id && editingPct?.field === 'currentValue' ? (
                    <input
                      value={editVal}
                      autoFocus
                      type="number"
                      className="w-16 bg-mh-card border border-mh-border rounded px-1 text-xs text-mh-text outline-none"
                      onChange={e => setEditVal(e.target.value)}
                      onBlur={() => { updateField('short', g.id, 'currentValue', Number(editVal)); setEditingPct(null) }}
                      onKeyDown={e => { if (e.key === 'Enter') { updateField('short', g.id, 'currentValue', Number(editVal)); setEditingPct(null) } }}
                    />
                  ) : (
                    <button onClick={() => { setEditingPct({ id: g.id, type: 'short', field: 'currentValue' }); setEditVal(String(g.currentValue)) }} className="hover:text-mh-text">
                      {g.currentValue} / {g.targetValue}
                    </button>
                  )}
                </span>
                {g.dueDate && <span>Due {g.dueDate}</span>}
                <button onClick={() => updateField('short', g.id, 'status', g.status === 'Done' ? 'Active' : 'Done')} className="hover:text-mh-text">
                  {g.status === 'Done' ? 'Reopen' : 'Mark done'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Right: Long-term Goals */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Long-term Goals & Projects</p>
          <button onClick={() => setAddLongModal(true)} className="text-xs text-mh-vermillion hover:text-red-400">+ Add</button>
        </div>

        {(data?.longTerm ?? []).length === 0 && (
          <p className="text-mh-muted text-sm italic card py-6 text-center">No long-term goals yet.</p>
        )}

        {(data?.longTerm ?? []).map(g => {
          const goalTasks = tasksFor(g.id)
          const doneTasks = goalTasks.filter(t => t.status === 'Done').length
          const isExpanded = expandedGoal === g.id
          const avgPct = goalTasks.length > 0
            ? Math.round(goalTasks.reduce((s, t) => s + t.percentDone, 0) / goalTasks.length)
            : g.percentComplete

          return (
            <div key={g.id} className="card space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-mh-text">{g.title}</p>
                  {g.description && <p className="text-[11px] text-mh-muted mt-0.5">{g.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {g.owner && <span className="text-[10px] text-mh-muted">{g.owner}</span>}
                  <button onClick={() => deleteGoal('long', g.id)} className="text-mh-muted/40 hover:text-red-400 text-xs">×</button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <GaugeBar current={avgPct} target={100} color="#9966FF" />
                <span className="text-xs text-mh-muted shrink-0">{avgPct}%</span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-mh-muted">
                <button onClick={() => setExpandedGoal(isExpanded ? null : g.id)} className="hover:text-mh-text">
                  {goalTasks.length} tasks ({doneTasks} done) {isExpanded ? '▲' : '▼'}
                </button>
                {g.targetDate && <span>Target {g.targetDate}</span>}
                <button onClick={() => setAddTaskModal(g.id)} className="text-mh-vermillion hover:text-red-400">+ Task</button>
              </div>

              {isExpanded && goalTasks.length > 0 && (
                <div className="border-t border-mh-border pt-2 space-y-1.5 mt-1">
                  {goalTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-2 text-xs">
                      <button
                        onClick={() => updateField('task', t.id, 'status', t.status === 'Done' ? 'Pending' : 'Done')}
                        className={`w-4 h-4 rounded shrink-0 border flex items-center justify-center text-[10px] ${t.status === 'Done' ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'border-mh-border'}`}
                      >
                        {t.status === 'Done' ? '✓' : ''}
                      </button>
                      <span className={`flex-1 min-w-0 truncate ${t.status === 'Done' ? 'line-through text-mh-muted' : 'text-mh-text'}`}>{t.task}</span>
                      {t.assignee && <span className="text-mh-muted shrink-0">{t.assignee}</span>}
                      {t.dueDate && <span className="text-mh-muted shrink-0">{t.dueDate}</span>}
                      <button onClick={() => deleteGoal('task', t.id)} className="text-mh-muted/30 hover:text-red-400 shrink-0">×</button>
                    </div>
                  ))}
                </div>
              )}

              {isExpanded && goalTasks.length === 0 && (
                <p className="text-[10px] text-mh-muted italic pt-1 border-t border-mh-border mt-1">No tasks yet — click + Task to add.</p>
              )}
            </div>
          )
        })}
      </div>

      {addShortModal && (
        <AddShortTermModal
          onAdd={(title, target, due) => addGoal('short', { title, targetValue: target, dueDate: due })}
          onClose={() => setAddShortModal(false)}
        />
      )}

      {addLongModal && (
        <AddLongTermModal
          onAdd={(title, desc, targetDate, owner) => addGoal('long', { title, description: desc, targetDate, owner })}
          onClose={() => setAddLongModal(false)}
        />
      )}

      {addTaskModal && (
        <AddTaskModal
          goalId={addTaskModal}
          onAdd={addTask}
          onClose={() => setAddTaskModal(null)}
        />
      )}
    </div>
  )
}
