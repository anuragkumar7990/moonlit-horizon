'use client'
import { useState, useEffect } from 'react'
import type { TrainerPipelineSummary, TrainerRosterEntry, TopicCoverageEntry } from '@/lib/sheets'

interface SupplyData {
  pipeline?: TrainerPipelineSummary
  roster?: TrainerRosterEntry[]
  coverage?: TopicCoverageEntry[]
  fetchedAt?: string
  error?: string
}

type View = 'pipeline' | 'roster' | 'coverage'

const TIER_COLOR: Record<string, { bg: string; color: string }> = {
  'Tier-1': { bg: '#FFD70022', color: '#FFD700' },
  'Tier-2': { bg: '#22C55E22', color: '#22C55E' },
  'Tier-3': { bg: '#60A5FA22', color: '#60A5FA' },
}

function PipelineStep({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="card text-center">
      <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-2 leading-tight">{label}</p>
      <p className="text-3xl font-semibold text-mh-text">{value}</p>
      {note && <p className="text-[10px] text-mh-muted mt-1">{note}</p>}
    </div>
  )
}

export default function SupplyModule() {
  const [data, setData] = useState<SupplyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('pipeline')
  const [skillFilter, setSkillFilter] = useState('')

  useEffect(() => {
    fetch('/api/supply')
      .then(r => r.json())
      .then((d: SupplyData) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="py-16 text-center text-mh-muted text-sm">Loading supply data…</div>
  }

  if (!data || data.error) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-red-400 text-sm font-medium">Failed to load supply data</p>
        <p className="text-mh-muted text-xs max-w-md mx-auto font-mono bg-mh-surface border border-mh-border rounded-lg px-4 py-3">
          {data?.error ?? 'Network error — could not reach /api/supply'}
        </p>
        <p className="text-[11px] text-mh-muted">
          Check that the Google credentials have access to the trainer Google Sheets.
        </p>
      </div>
    )
  }

  const EMPTY_PIPELINE: TrainerPipelineSummary = {
    outreachTotal: 0, connected: 0, formFilled: 0,
    emailSent: 0, whatsappSent: 0, meetingBooked: 0,
    meetingConducted: 0, sampleTaken: 0, onboarded: 0,
  }
  const p = data.pipeline ?? EMPTY_PIPELINE
  const roster = data?.roster ?? []
  const coverage = data?.coverage ?? []

  const filteredRoster = skillFilter
    ? roster.filter(t => t.skills.some(s => s.toLowerCase().includes(skillFilter.toLowerCase())) ||
        t.name.toLowerCase().includes(skillFilter.toLowerCase()))
    : roster

  const filteredCoverage = skillFilter
    ? coverage.filter(t => t.topic.toLowerCase().includes(skillFilter.toLowerCase()) ||
        t.category.toLowerCase().includes(skillFilter.toLowerCase()))
    : coverage

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-mh-text">Trainer Supply</h2>
          {data?.fetchedAt && (
            <p className="text-xs text-mh-muted mt-0.5">
              Synced {new Date(data.fetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {(view === 'roster' || view === 'coverage') && (
            <input
              value={skillFilter}
              onChange={e => setSkillFilter(e.target.value)}
              placeholder={view === 'roster' ? 'Filter by name / skill…' : 'Filter by topic / category…'}
              className="bg-mh-bg border border-mh-border rounded-lg px-3 py-1.5 text-sm text-mh-text
                outline-none focus:border-mh-vermillion placeholder:text-mh-muted transition-colors w-56"
            />
          )}
          <div className="flex gap-0 border border-mh-border rounded-lg overflow-hidden">
            {(['pipeline', 'roster', 'coverage'] as View[]).map(v => (
              <button
                key={v}
                onClick={() => { setView(v); setSkillFilter('') }}
                className={`px-4 py-1.5 text-xs font-medium transition-colors capitalize
                  ${view === v ? 'bg-mh-vermillion text-white' : 'text-mh-muted hover:text-mh-text'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline view */}
      {view === 'pipeline' && p && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <PipelineStep label="Outreach Total" value={p.outreachTotal} note="LinkedIn connections sent" />
            <PipelineStep label="Connected" value={p.connected} note="accepted connection" />
            <PipelineStep label="Form Filled" value={p.formFilled} note="trainer profile submitted" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <PipelineStep label="Meeting Booked" value={p.meetingBooked} />
            <PipelineStep label="Meeting Conducted" value={p.meetingConducted} />
            <PipelineStep label="Sample Taken" value={p.sampleTaken} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <PipelineStep label="Onboarded" value={p.onboarded} note="contract signed" />
            <div className="card col-span-2">
              <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">Pipeline Conversion</p>
              <div className="space-y-2">
                {[
                  { label: 'Outreach → Connected', num: p.connected, den: p.outreachTotal },
                  { label: 'Connected → Form Filled', num: p.formFilled, den: p.connected },
                  { label: 'Form Filled → Meeting', num: p.meetingBooked, den: p.formFilled },
                  { label: 'Meeting → Onboarded', num: p.onboarded, den: p.meetingConducted },
                ].map(({ label, num, den }) => {
                  const pct = den > 0 ? Math.round((num / den) * 100) : 0
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-mh-muted w-44 shrink-0">{label}</span>
                      <div className="flex-1 h-1.5 bg-mh-border rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-mh-vermillion"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-mh-text font-semibold w-10 text-right">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Roster view */}
      {view === 'roster' && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mh-border bg-mh-surface">
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Trainer</th>
                <th className="text-center px-4 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Tier</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Score</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Skills</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mh-border">
              {filteredRoster.map(t => {
                const tc = TIER_COLOR[t.tier] ?? { bg: '#9CA3AF22', color: '#9CA3AF' }
                return (
                  <tr key={t.name} className="hover:bg-mh-surface/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-mh-text font-medium">{t.name}</p>
                      {t.profileDetails && (
                        <p className="text-[11px] text-mh-muted mt-0.5 truncate max-w-xs">{t.profileDetails}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: tc.color, backgroundColor: tc.bg }}
                      >
                        {t.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-mh-text font-semibold">{t.score}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {t.skills.slice(0, 4).map(s => (
                          <span
                            key={s}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-mh-surface text-mh-muted border border-mh-border"
                          >
                            {s}
                          </span>
                        ))}
                        {t.skills.length > 4 && (
                          <span className="text-[10px] px-1.5 py-0.5 text-mh-muted">+{t.skills.length - 4}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredRoster.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-mh-muted text-sm">
                    {skillFilter ? `No trainers matching "${skillFilter}"` : 'No trainers in roster yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Topic Coverage view */}
      {view === 'coverage' && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mh-border bg-mh-surface">
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Topic</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Category</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">T1 Price</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">T2 Price</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">T3 Price</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Trainers Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mh-border">
              {filteredCoverage.map(t => (
                <tr key={t.topic} className="hover:bg-mh-surface/40 transition-colors">
                  <td className="px-5 py-3 text-mh-text font-medium">{t.topic}</td>
                  <td className="px-4 py-3 text-mh-muted text-xs">{t.category || '—'}</td>
                  <td className="px-4 py-3 text-right text-mh-text text-xs">
                    {t.tier1Price > 0 ? `₹${t.tier1Price.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-mh-text text-xs">
                    {t.tier2Price > 0 ? `₹${t.tier2Price.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-mh-text text-xs">
                    {t.tier3Price > 0 ? `₹${t.tier3Price.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {t.trainers.slice(0, 3).map(tr => (
                        <span key={tr} className="text-[10px] px-1.5 py-0.5 rounded bg-mh-surface text-mh-muted border border-mh-border">
                          {tr}
                        </span>
                      ))}
                      {t.trainers.length > 3 && (
                        <span className="text-[10px] text-mh-muted">+{t.trainers.length - 3}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCoverage.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-mh-muted text-sm">
                    {skillFilter ? `No topics matching "${skillFilter}"` : 'No topic coverage data yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
