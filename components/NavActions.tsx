'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

export default function NavActions() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  // Recalculate position whenever dropdown opens
  useEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 8, right: window.innerWidth - r.right })
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 bg-mh-vermillion text-white px-4 py-1.5 rounded-full
          hover:opacity-90 font-medium text-sm transition-opacity select-none"
      >
        Quick Actions
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="w-52 bg-mh-surface border border-mh-border rounded-xl shadow-xl overflow-hidden py-1"
        >
          <p className="px-4 pt-2 pb-1 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">
            Book
          </p>
          <Link href="/book-prospect" onClick={() => setOpen(false)}
            className="flex items-center px-4 py-2 text-sm text-mh-text hover:bg-mh-border/30 transition-colors">
            Book Prospect
          </Link>
          <Link href="/book" onClick={() => setOpen(false)}
            className="flex items-center px-4 py-2 text-sm text-mh-text hover:bg-mh-border/30 transition-colors">
            Book Contact
          </Link>

          <div className="border-t border-mh-border my-1" />

          <Link href="/upload" onClick={() => setOpen(false)}
            className="flex items-center px-4 py-2.5 text-sm text-mh-text hover:bg-mh-border/30 transition-colors">
            Upload Prospect CSV
          </Link>
        </div>
      )}
    </>
  )
}
