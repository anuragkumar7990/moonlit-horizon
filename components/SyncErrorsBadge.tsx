'use client'
import { useEffect, useState } from 'react'

// Small badge showing how many background sync failures (Zoho/Sheets writes that failed
// silently before) landed in the Sync_Errors sheet in the last 24h. Renders nothing when
// there are none, so it doesn't add visual noise on a healthy day.
export default function SyncErrorsBadge() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    function load() {
      fetch('/api/sync-errors/count')
        .then(r => r.json())
        .then((d: { count?: number }) => { if (!cancelled) setCount(d.count ?? 0) })
        .catch(() => {})
    }
    load()
    const interval = setInterval(load, 5 * 60 * 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  if (!count) return null

  return (
    <span
      title={`${count} sync error${count === 1 ? '' : 's'} in the last 24h — see the Sync_Errors sheet tab`}
      className="text-[11px] font-semibold px-2 py-1 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(232,52,28,0.15)', color: '#E8341C', border: '1px solid rgba(232,52,28,0.3)' }}
    >
      {count} sync error{count === 1 ? '' : 's'}
    </span>
  )
}
