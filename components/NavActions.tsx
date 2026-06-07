'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

export default function NavActions() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
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
        <div className="absolute right-0 mt-2 w-52 bg-mh-surface border border-mh-border rounded-xl shadow-lg
          overflow-hidden z-50 py-1">

          {/* Book section */}
          <p className="px-4 pt-2 pb-1 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">
            Book
          </p>
          <Link href="/book-prospect"
            onClick={() => setOpen(false)}
            className="flex items-center px-4 py-2 text-sm text-mh-text hover:bg-mh-border/30 transition-colors">
            Book Prospect
          </Link>
          <Link href="/book"
            onClick={() => setOpen(false)}
            className="flex items-center px-4 py-2 text-sm text-mh-text hover:bg-mh-border/30 transition-colors">
            Book Contact
          </Link>

          <div className="border-t border-mh-border my-1" />

          {/* Upload */}
          <Link href="/upload"
            onClick={() => setOpen(false)}
            className="flex items-center px-4 py-2.5 text-sm text-mh-text hover:bg-mh-border/30 transition-colors">
            Upload Prospect CSV
          </Link>
        </div>
      )}
    </div>
  )
}
