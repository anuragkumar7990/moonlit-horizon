'use client'

export default function EmailsModule() {
  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-3">
      <div className="w-12 h-12 rounded-full bg-mh-surface border border-mh-border flex items-center justify-center">
        <svg className="w-6 h-6 text-mh-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="text-mh-muted text-sm">Emails module — coming soon</p>
      <p className="text-[11px] text-mh-muted opacity-60 max-w-xs text-center">
        Will show weekly &amp; monthly email send counts, open rates, and thread activity per source.
      </p>
    </div>
  )
}
