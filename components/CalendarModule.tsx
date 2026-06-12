'use client'
import { useState, useEffect, useMemo } from 'react'
import type { Meeting, Task } from '@/lib/types'
import type { CalendarEvent } from '@/lib/booking'

// ── Types ─────────────────────────────────────────────────────────────────────

type DayEntry =
  | { kind: 'meeting'; time: string; account: string; meetingType: 'L1' | 'L2+'; gMeetLink: string; status: string }
  | { kind: 'task'; text: string; taskType: 'P0' | 'Objective'; assignedTo: string; done: boolean }

// ── Constants & helpers ───────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayIST(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
}

function buildGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7 // Mon = 0
  const gridStart = new Date(firstDay)
  gridStart.setDate(firstDay.getDate() - startOffset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
}

function inferTypeFromTitle(title: string): 'L1' | 'L2+' {
  const t = title.toLowerCase()
  if (t.includes('l2') || t.includes('level 2') || t.includes('demo') || t.includes('outline')) return 'L2+'
  return 'L1'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-lg border border-mh-border bg-mh-surface">
      <span className="text-lg font-bold text-white tabular-nums">{value}</span>
      <span className="text-[11px] text-mh-muted">{label}</span>
    </div>
  )
}

function EntryLine({ entry, isPast }: { entry: DayEntry; isPast: boolean }) {
  if (entry.kind === 'meeting') {
    const color = entry.meetingType === 'L2+' ? 'text-violet-400' : 'text-sky-400'
    return (
      <div className={`flex items-center gap-0.5 text-[10px] leading-tight min-w-0 ${isPast ? 'opacity-50' : ''}`}>
        <span className={`shrink-0 ${color} text-[8px]`}>●</span>
        <span className={`truncate ${isPast ? 'text-mh-muted' : 'text-white'} min-w-0`}>
          {entry.time ? `${entry.time} ` : ''}{entry.account.slice(0, 11)}
        </span>
        <span className={`shrink-0 text-[9px] font-bold ${color} ml-0.5`}>{entry.meetingType}</span>
        {entry.gMeetLink && (
          <a
            href={entry.gMeetLink}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className={`shrink-0 ${color} hover:opacity-70 ml-0.5`}
          >
            ↗
          </a>
        )}
      </div>
    )
  }

  const color = entry.taskType === 'P0' ? 'text-mh-vermillion' : 'text-amber-400'
  const initials = entry.assignedTo.slice(0, 2).toUpperCase()
  return (
    <div className={`flex items-center gap-0.5 text-[10px] leading-tight min-w-0 ${isPast ? 'opacity-50' : ''}`}>
      <span className={`shrink-0 ${color} text-[8px]`}>▸</span>
      <span className={`truncate min-w-0 ${
        entry.done ? 'line-through text-mh-muted' : isPast ? 'text-mh-muted' : 'text-white/80'
      }`}>
        {entry.text.slice(0, 12)}
      </span>
      <span className={`shrink-0 text-[9px] font-bold ${color} ml-auto pl-0.5`}>{initials}</span>
    </div>
  )
}

// ── Main module ───────────────────────────────────────────────────────────────

export default function CalendarModule({
  rawMeetings,
  calEvents,
}: {
  rawMeetings: Meeting[]
  calEvents: CalendarEvent[]
}) {
  const today = todayIST()
  const nowLocal = new Date()

  const [displayYear, setDisplayYear]   = useState(nowLocal.getFullYear())
  const [displayMonth, setDisplayMonth] = useState(nowLocal.getMonth())
  const [tasks, setTasks]               = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then((d: { tasks?: Task[] }) => setTasks(d.tasks ?? []))
      .catch(() => {})
      .finally(() => setTasksLoading(false))
  }, [])

  // Build the day → entries map
  const dayMap = useMemo(() => {
    const map = new Map<string, DayEntry[]>()
    const push = (key: string, entry: DayEntry) => {
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(entry)
    }

    // Track gMeetLinks already covered by rawMeetings (for dedup with calEvents)
    const knownGMeetLinks = new Set(rawMeetings.map(m => m.gMeetLink).filter(Boolean))

    for (const m of rawMeetings) {
      const key = m.meetingTime?.slice(0, 10)
      if (!key || key < '2020-01-01') continue
      push(key, {
        kind:        'meeting',
        time:        m.meetingTime.slice(11, 16),
        account:     m.accountName,
        meetingType: m.meetingType,
        gMeetLink:   m.gMeetLink,
        status:      m.status,
      })
    }

    for (const e of calEvents) {
      if (e.gMeetLink && knownGMeetLinks.has(e.gMeetLink)) continue
      const key = e.startTime?.slice(0, 10)
      if (!key) continue
      push(key, {
        kind:        'meeting',
        time:        e.startTime.slice(11, 16),
        account:     e.title,
        meetingType: inferTypeFromTitle(e.title),
        gMeetLink:   e.gMeetLink ?? '',
        status:      'Meeting Booked',
      })
    }

    for (const t of tasks) {
      const key = t.date?.slice(0, 10)
      if (!key || key < '2020-01-01') continue
      push(key, {
        kind:      'task',
        text:      t.task,
        taskType:  t.type,
        assignedTo: t.assignedTo,
        done:      t.status === 'Done',
      })
    }

    // Sort each day: meetings first (by time), then tasks
    map.forEach((entries, k) => {
      map.set(k, entries.sort((a: DayEntry, b: DayEntry) => {
        if (a.kind !== b.kind) return a.kind === 'meeting' ? -1 : 1
        if (a.kind === 'meeting' && b.kind === 'meeting') return a.time.localeCompare(b.time)
        return 0
      }))
    })

    return map
  }, [rawMeetings, calEvents, tasks])

  // Stats for the displayed month
  const monthPrefix = `${displayYear}-${String(displayMonth + 1).padStart(2, '0')}`
  const monthMeetings = rawMeetings.filter(m => m.meetingTime?.startsWith(monthPrefix))
  const l1Count  = monthMeetings.filter(m => m.meetingType === 'L1').length
  const l2Count  = monthMeetings.filter(m => m.meetingType === 'L2+').length
  const openTasksCount = tasks.filter(t => t.status !== 'Done').length

  const grid = useMemo(() => buildGrid(displayYear, displayMonth), [displayYear, displayMonth])

  function prevMonth() {
    if (displayMonth === 0) { setDisplayYear(y => y - 1); setDisplayMonth(11) }
    else setDisplayMonth(m => m - 1)
  }
  function nextMonth() {
    if (displayMonth === 11) { setDisplayYear(y => y + 1); setDisplayMonth(0) }
    else setDisplayMonth(m => m + 1)
  }

  return (
    <div className="space-y-6 py-2">

      {/* Stats strip */}
      <div className="flex flex-wrap gap-2">
        <StatChip label="Meetings"   value={monthMeetings.length} />
        <StatChip label="L1"         value={l1Count} />
        <StatChip label="L2+"        value={l2Count} />
        <StatChip label="Open Tasks" value={tasksLoading ? '…' : openTasksCount} />
      </div>

      {/* Month grid */}
      <div className="rounded-xl border border-mh-border overflow-hidden">

        {/* Month header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-mh-border bg-mh-surface">
          <span className="text-sm font-bold text-white">
            {MONTH_NAMES[displayMonth]} {displayYear}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="w-7 h-7 flex items-center justify-center rounded text-mh-muted hover:text-white hover:bg-white/10 transition-colors"
            >
              ‹
            </button>
            <button
              onClick={nextMonth}
              className="w-7 h-7 flex items-center justify-center rounded text-mh-muted hover:text-white hover:bg-white/10 transition-colors"
            >
              ›
            </button>
          </div>
        </div>

        {/* Day-of-week labels */}
        <div className="grid grid-cols-7 border-b border-mh-border bg-mh-surface">
          {DAY_LABELS.map(d => (
            <div key={d} className="px-2 py-1.5 text-center text-[11px] font-medium text-mh-muted">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {grid.map((day, i) => {
            const key      = toDateKey(day)
            const inMonth  = day.getMonth() === displayMonth && day.getFullYear() === displayYear
            const isToday  = key === today
            const isPast   = key < today
            const entries  = dayMap.get(key) ?? []
            const visible  = entries.slice(0, 2)
            const overflow = entries.length - 2

            const borderR = i % 7 !== 6 ? 'border-r' : ''
            const borderB = i < 35     ? 'border-b' : ''

            return (
              <div
                key={i}
                className={`min-h-[76px] p-1.5 flex flex-col gap-0.5 border-mh-border ${borderR} ${borderB} ${
                  !inMonth ? 'bg-mh-bg/40' : ''
                }`}
              >
                <span className={`text-[11px] font-medium w-5 h-5 flex items-center justify-center rounded-full mb-0.5 shrink-0 ${
                  isToday
                    ? 'bg-mh-vermillion text-white'
                    : !inMonth
                      ? 'text-mh-muted/40'
                      : isPast
                        ? 'text-mh-muted'
                        : 'text-white'
                }`}>
                  {day.getDate()}
                </span>

                {visible.map((entry, j) => (
                  <EntryLine key={j} entry={entry} isPast={isPast} />
                ))}

                {overflow > 0 && (
                  <span className="text-[10px] text-mh-muted leading-tight">
                    +{overflow} more
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
