'use client'
import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import type { TanishqMetrics, TodayMeeting, FollowUpItem } from '@/lib/dashboard'

type Period = 'daily' | 'weekly' | 'monthly'

function TargetCard({
  label,
  achieved,
  target,
}: {
  label: string
  achieved: number
  target: number | null
}) {
  const hit = target !== null && target > 0 && achieved >= target
  return (
    <div className="card flex-1 text-center">
      <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-3">{label}</p>
      <p className={`text-4xl font-semibold ${hit ? 'text-mh-gold glow-gold' : 'text-mh-text'}`}>{achieved}</p>
      <p className="text-sm text-mh-muted mt-1">
        {target !== null ? `/ ${target}` : '— no target set'}
      </p>
    </div>
  )
}

function formatMeetingTime(dt: string): string {
  try { return format(parseISO(dt), 'h:mm a') } catch { return dt }
}

export default function TanishqDashboard({
  metrics,
  todaysMeetings,
  followUps,
}: {
  metrics: TanishqMetrics
  todaysMeetings: TodayMeeting[]
  followUps: FollowUpItem[]
}) {
  const [period, setPeriod] = useState<Period>('daily')
  const m = metrics[period]

  return (
    <div className="space-y-6">

      {/* Targets vs Achieved */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Targets vs Achieved</p>
          <div className="flex items-center gap-1 bg-mh-surface border border-mh-border rounded-full p-1">
            {(['daily', 'weekly', 'monthly'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`text-xs px-3 py-1 rounded-full font-medium capitalize transition-colors
                  ${period === p
                    ? 'bg-mh-vermillion text-white'
                    : 'text-mh-muted hover:text-mh-text'
                  }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-4">
          <TargetCard label="Dialled"         achieved={m.dialled.achieved}        target={m.dialled.target}        />
          <TargetCard label="Connected"        achieved={m.connected.achieved}       target={m.connected.target}       />
          <TargetCard label="Meetings Booked"  achieved={m.meetingsBooked.achieved}  target={m.meetingsBooked.target}  />
        </div>
      </div>

      {/* Meetings Today + Follow-ups */}
      <div className="grid grid-cols-2 gap-4">

        {/* Meetings Today */}
        <div className="card">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-4">
            Meetings Today
            {todaysMeetings.length > 0 && (
              <span className="text-mh-vermillion ml-2">{todaysMeetings.length}</span>
            )}
          </p>
          {todaysMeetings.length === 0 ? (
            <p className="text-mh-muted text-sm italic">No meetings scheduled for today</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {todaysMeetings.map(mtg => (
                <div
                  key={mtg.meetingId}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg bg-mh-surface2 border border-mh-border"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-mh-text truncate">{mtg.accountName}</p>
                    <p className="text-xs text-mh-muted mt-0.5">{mtg.contactName} · {mtg.meetingType}</p>
                    <p className="text-xs text-mh-vermillion mt-0.5">{formatMeetingTime(mtg.meetingTime)}</p>
                  </div>
                  {mtg.gMeetLink && (
                    <a
                      href={mtg.gMeetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs px-2 py-1 rounded bg-mh-surface border border-mh-border
                        text-mh-muted hover:text-mh-text hover:border-mh-vermillion transition-colors"
                    >
                      Join
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Follow-ups */}
        <div className="card">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-4">
            Follow-ups Today
            {followUps.length > 0 && (
              <span className="text-mh-vermillion ml-2">{followUps.length}</span>
            )}
          </p>
          {followUps.length === 0 ? (
            <p className="text-mh-muted text-sm italic">No follow-ups scheduled for today</p>
          ) : (
            <div className="space-y-3">
              {followUps.map((f, i) => (
                <div key={i} className="p-3 rounded-lg bg-mh-surface2 border border-mh-border">
                  <p className="text-sm font-medium text-mh-text">{f.account}</p>
                  <p className="text-xs text-mh-muted mt-0.5">{f.contactName}{f.contactPhone ? ` · ${f.contactPhone}` : ''}</p>
                  {f.notes && (
                    <p className="text-xs text-mh-muted mt-1 italic line-clamp-2">{f.notes}</p>
                  )}
                  <p className="text-[10px] text-mh-vermillion mt-1.5 uppercase tracking-wide">
                    prev: {f.outcome || 'unknown'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Prospects to Call */}
      <div className="card">
        <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">
          Top Prospects to Call
        </p>
        <p className="text-mh-muted text-sm italic leading-relaxed">
          Top-250 list available once prospect scoring is live (Phase 2).
          Re-ranking runs every Sunday 11pm — top 250 leads by score are assigned for the week.
          Daily batches of 50 (Mon–Fri) with a CSV download link will appear here.
        </p>
      </div>

    </div>
  )
}
