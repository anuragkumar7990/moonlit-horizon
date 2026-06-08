'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import PreMeetingEmailModal from './PreMeetingEmailModal'

export default function NavActions() {
  const [open, setOpen]             = useState(false)
  const [pos, setPos]               = useState({ top: 0, right: 0 })
  const [showEmailDraft, setShowEmailDraft] = useState(false)
  const btnRef      = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Recalculate position whenever dropdown opens
  useEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 8, right: window.innerWidth - r.right })
  }, [open])

  // Close on outside click — must exclude the dropdown panel itself so item clicks register
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const target = e.target as Node
      const insideBtn      = btnRef.current?.contains(target) ?? false
      const insideDropdown = dropdownRef.current?.contains(target) ?? false
      if (!insideBtn && !insideDropdown) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <>
      {showEmailDraft && (
        <PreMeetingEmailModal onClose={() => setShowEmailDraft(false)} />
      )}

      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className="btn-shimmer flex items-center gap-1.5 text-white px-4 py-1.5 rounded-full
          font-medium text-sm select-none transition-all hover:shadow-[0_0_16px_rgba(232,52,28,0.5)]"
        style={{
          background: 'linear-gradient(135deg, #E8341C, #FF5A3A)',
          boxShadow: '0 2px 12px rgba(232,52,28,0.35)',
        }}
      >
        Quick Actions
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && typeof window !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="w-56 bg-mh-surface border border-mh-border rounded-xl shadow-xl overflow-hidden py-1"
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

          <p className="px-4 pt-1 pb-1 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">
            Outreach
          </p>
          <button
            onClick={() => { setOpen(false); setShowEmailDraft(true) }}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-mh-text hover:bg-mh-border/30 transition-colors text-left"
          >
            <span>✉️</span> Draft Pre-Meeting Email
          </button>

          <div className="border-t border-mh-border my-1" />

          <Link href="/upload" onClick={() => setOpen(false)}
            className="flex items-center px-4 py-2.5 text-sm text-mh-text hover:bg-mh-border/30 transition-colors">
            Upload Prospect CSV
          </Link>
        </div>,
        document.body
      )}
    </>
  )
}
