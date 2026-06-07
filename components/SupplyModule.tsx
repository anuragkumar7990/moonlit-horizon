'use client'
import { useState, useEffect } from 'react'

interface TrainerApplication {
  name: string
  email: string
  phone: string
  location: string
  linkedin: string
  expertiseAreas: string[]
  signatureTopic: string
  targetAudience: string[]
  certifications: string
  experienceYears: string
  submittedAt: string
}

interface ExpertiseCount { area: string; count: number }

interface RosterEntry {
  name: string
  profileDetails: string
  tier: string
  score: number
  hourlyRate: string
}

interface CoverageEntry {
  topic: string
  hourlyCharge: string
  dailyCharge: string
  trainers: string[]
}

interface SupplyData {
  pipeline?: {
    totalApplications: number
    expertiseBreakdown: ExpertiseCount[]
    recentApplications: TrainerApplication[]
  }
  roster?: RosterEntry[]
  coverage?: CoverageEntry[]
  fetchedAt?: string
  error?: string
}

type View = 'pipeline' | 'roster' | 'coverage'

const TIER_STYLE: Record<string, { bg: string; color: string }> = {
  'Tier-1': { bg: '#FFD70022', color: '#FFD700' },
  'Tier-2': { bg: '#22C55E22', color: '#22C55E' },
  'Tier-3': { bg: '#60A5FA22', color: '#60A5FA' },
}

function TierBadge({ tier }: { tier: string }) {
  const s = TIER_STYLE[tier] ?? { bg: '#9CA3AF22', color: '#9CA3AF' }
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color: s.color, backgroundColor: s.bg }}>
      {tier}
    </span>
  )
}

export default function SupplyModule() {
  const [data, setData] = useState<SupplyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('pipeline')
  const [filter, setFilter] = useState('')

  useEffect(() => {
    fetch('/api/supply')
      .then(r => r.json())
      .then((d: SupplyData) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-16 text-center text-mh-muted text-sm">Loading supply data…</div>

  if (!data || data.error) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-red-400 text-sm font-medium">Failed to load supply data</p>
        <p className="text-mh-muted text-xs max-w-md mx-auto font-mono bg-mh-surface border border-mh-border rounded-lg px-4 py-3">
          {data?.error ?? 'Network error — could not reach /api/supply'}
        </p>
      </div>
    )
  }

  const pipeline  = data.pipeline
  const roster    = data.roster ?? []
  const coverage  = data.coverage ?? []

  const filteredRoster = filter
    ? roster.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()) ||
        t.profileDetails.toLowerCase().includes(filter.toLowerCase()))
    : roster

  const filteredCoverage = filter
    ? coverage.filter(t => t.topic.toLowerCase().includes(filter.toLowerCase()))
    : coverage

  const filteredApps = filter && pipeline
    ? pipeline.recentApplications.filter(a =>
        a.name.toLowerCase().includes(filter.toLowerCase()) ||
        a.expertiseAreas.some(e => e.toLowerCase().includes(filter.toLowerCase())) ||
        a.location.toLowerCase().includes(filter.toLowerCase()))
    : pipeline?.recentApplications ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-mh-text">Trainer Supply</h2>
          {data.fetchedAt && (
            <p className="text-xs text-mh-muted mt-0.5">
              Synced {new Date(data.fetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter…"
            className="bg-mh-bg border border-mh-border rounded-lg px-3 py-1.5 text-sm text-mh-text
              outline-none focus:border-mh-vermillion placeholder:text-mh-muted transition-colors w-48"
          />
          <div className="flex gap-0 border border-mh-border rounded-lg overflow-hidden">
            {(['pipeline', 'roster', 'coverage'] as View[]).map(v => (
              <button key={v} onClick={() => { setView(v); setFilter('') }}
                className={`px-4 py-1.5 text-xs font-medium transition-colors capitalize
                  ${view === v ? 'bg-mh-vermillion text-white' : 'text-mh-muted hover:text-mh-text'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Pipeline view ── */}
      {view === 'pipeline' && pipeline && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="card">
              <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-2">Applications</p>
              <p className="text-3xl font-semibold text-mh-text">{pipeline.totalApplications}</p>
              <p className="text-xs text-mh-muted mt-1">trainer profiles received</p>
            </div>
            <div className="card">
              <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-2">Vetted Trainers</p>
              <p className="text-3xl font-semibold text-mh-text">{roster.length}</p>
              <p className="text-xs text-mh-muted mt-1">in roster (Sheet B)</p>
            </div>
            <div className="card">
              <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-2">Topics Covered</p>
              <p className="text-3xl font-semibold text-mh-text">{coverage.length}</p>
              <p className="text-xs text-mh-muted mt-1">training topics</p>
            </div>
            <div className="card">
              <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-2">Top Expertise</p>
              <p className="text-base font-semibold text-mh-text leading-tight mt-1">
                {pipeline.expertiseBreakdown[0]?.area ?? '—'}
              </p>
              <p className="text-xs text-mh-muted mt-1">
                {pipeline.expertiseBreakdown[0]?.count ?? 0} applicants
              </p>
            </div>
          </div>

          {/* Expertise breakdown + recent applications */}
          <div className="grid grid-cols-[280px_1fr] gap-4">
            {/* Expertise bars */}
            <div className="card">
              <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-4">Expertise Areas</p>
              <div className="space-y-3">
                {pipeline.expertiseBreakdown.map(({ area, count }) => {
                  const max = pipeline.expertiseBreakdown[0]?.count ?? 1
                  return (
                    <div key={area}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-mh-text truncate max-w-[180px]">{area}</span>
                        <span className="text-xs text-mh-muted ml-2 shrink-0">{count}</span>
                      </div>
                      <div className="h-1 bg-mh-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-mh-vermillion"
                          style={{ width: `${Math.round((count / max) * 100)}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Recent applications */}
            <div className="card overflow-hidden p-0">
              <div className="px-5 py-3 border-b border-mh-border">
                <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Recent Applications</p>
              </div>
              <div className="overflow-auto max-h-80">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-mh-border bg-mh-surface">
                      {['Name', 'Location', 'Expertise', 'Experience', 'Applied'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-mh-muted uppercase tracking-widest whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mh-border">
                    {filteredApps.map((app, i) => (
                      <tr key={i} className="hover:bg-mh-surface/40 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-mh-text font-medium">{app.name}</p>
                          {app.linkedin && (
                            <a href={app.linkedin.startsWith('http') ? app.linkedin : `https://${app.linkedin}`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-[10px] text-mh-vermillion hover:underline">LinkedIn</a>
                          )}
                        </td>
                        <td className="px-4 py-3 text-mh-muted text-xs">{app.location || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {app.expertiseAreas.slice(0, 2).map(e => (
                              <span key={e} className="text-[10px] px-1.5 py-0.5 rounded bg-mh-surface text-mh-muted border border-mh-border">{e}</span>
                            ))}
                            {app.expertiseAreas.length > 2 && (
                              <span className="text-[10px] text-mh-muted">+{app.expertiseAreas.length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-mh-muted text-xs whitespace-nowrap">{app.experienceYears || '—'}</td>
                        <td className="px-4 py-3 text-mh-muted text-xs whitespace-nowrap">
                          {app.submittedAt ? new Date(app.submittedAt.split(' ')[0].split('/').reverse().join('-')).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                        </td>
                      </tr>
                    ))}
                    {filteredApps.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-mh-muted text-sm">No applications found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Roster view ── */}
      {view === 'roster' && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mh-border bg-mh-surface">
                {['Trainer', 'Tier', 'Score', 'Hourly Rate', 'Profile'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-mh-border">
              {filteredRoster.map(t => (
                <tr key={t.name} className="hover:bg-mh-surface/40 transition-colors">
                  <td className="px-5 py-3.5 text-mh-text font-medium">{t.name}</td>
                  <td className="px-5 py-3.5"><TierBadge tier={t.tier} /></td>
                  <td className="px-5 py-3.5 text-mh-text font-semibold">{t.score || '—'}</td>
                  <td className="px-5 py-3.5 text-mh-muted text-xs">{t.hourlyRate || '—'}</td>
                  <td className="px-5 py-3.5 text-mh-muted text-xs max-w-xs truncate">{t.profileDetails || '—'}</td>
                </tr>
              ))}
              {filteredRoster.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-mh-muted text-sm">
                  {filter ? `No trainers matching "${filter}"` : 'No vetted trainers in roster yet.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Coverage view ── */}
      {view === 'coverage' && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mh-border bg-mh-surface">
                {['Topic', 'Hourly Charge', 'Day Rate', 'Trainers Available'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-mh-border">
              {filteredCoverage.map(t => (
                <tr key={t.topic} className="hover:bg-mh-surface/40 transition-colors">
                  <td className="px-5 py-3 text-mh-text font-medium">{t.topic}</td>
                  <td className="px-5 py-3 text-mh-text text-xs">{t.hourlyCharge || '—'}</td>
                  <td className="px-5 py-3 text-mh-text text-xs">{t.dailyCharge || '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {t.trainers.map(tr => (
                        <span key={tr} className="text-[10px] px-1.5 py-0.5 rounded bg-mh-surface text-mh-muted border border-mh-border">{tr}</span>
                      ))}
                      {t.trainers.length === 0 && <span className="text-mh-muted text-xs">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCoverage.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-mh-muted text-sm">
                  {filter ? `No topics matching "${filter}"` : 'No topic coverage data found.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
