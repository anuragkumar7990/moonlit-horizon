'use client'
import { useEffect } from 'react'

export default function ViewError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[view/error]', error)
  }, [error])

  return (
    <div className="p-8 max-w-2xl">
      <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest mb-3">
        Server Error — Digest: {error.digest ?? 'n/a'}
      </p>
      <p className="text-sm font-mono text-red-300 mb-2 whitespace-pre-wrap break-all">
        {error.message || 'No error message'}
      </p>
      {error.stack && (
        <pre className="text-[11px] text-mh-muted mt-4 overflow-x-auto whitespace-pre-wrap break-all border border-mh-border rounded p-4 bg-mh-surface">
          {error.stack}
        </pre>
      )}
      <button
        onClick={reset}
        className="mt-6 px-4 py-2 rounded bg-mh-vermillion/20 border border-mh-vermillion text-mh-vermillion text-sm"
      >
        Retry
      </button>
    </div>
  )
}
