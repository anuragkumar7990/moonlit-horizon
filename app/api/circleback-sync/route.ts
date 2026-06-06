import { NextRequest, NextResponse } from 'next/server'
import { getMeetings, updateMeetingConducted } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

// Circleback REST API base — Bearer token stored in env
const CIRCLEBACK_BASE = 'https://app.circleback.ai/api'

interface CirclebackMeeting {
  id: number
  linkId: string
  name: string
  createdAt: string
  notes?: string
  attendees?: { name?: string; email?: string }[]
}

// Extract account name from "The Test Tribe <> Account Name | Meeting Type"
function extractAccount(meetingName: string): string {
  const m = meetingName.match(/The Test Tribe\s*<>\s*(.+?)\s*[|–—]/)
  if (m) return m[1].trim()
  // Fallback: return the whole name stripped of common prefixes
  return meetingName.replace(/^The Test Tribe\s*(<>|–|—)?\s*/i, '').trim()
}

// Normalise for comparison: lowercase, strip punctuation
function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

// Check if two account names are the same (fuzzy: one contains the other)
function accountsMatch(a: string, b: string): boolean {
  const na = normalise(a)
  const nb = normalise(b)
  return na === nb || na.includes(nb) || nb.includes(na)
}

// Check if two date strings are within 1 day of each other
function datesClose(d1: string, d2: string): boolean {
  try {
    const t1 = new Date(d1).getTime()
    const t2 = new Date(d2).getTime()
    return Math.abs(t1 - t2) <= 25 * 60 * 60 * 1000 // 25h window
  } catch { return false }
}

async function fetchCirclebackMeetings(from: string, to: string): Promise<CirclebackMeeting[]> {
  const token = process.env.CIRCLEBACK_API_KEY
  if (!token) throw new Error('CIRCLEBACK_API_KEY not set')

  const url = `${CIRCLEBACK_BASE}/meetings?from=${from}&to=${to}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Circleback API ${res.status}: ${text}`)
  }
  const data = await res.json() as { meetings?: CirclebackMeeting[] } | CirclebackMeeting[]
  return Array.isArray(data) ? data : (data.meetings ?? [])
}

interface SyncResult {
  matched: number
  alreadyConducted: number
  unmatched: number
  updated: { account: string; date: string; circlebackId: number }[]
  unmatchedNames: string[]
}

async function syncMeetings(circlebackMeetings: CirclebackMeeting[]): Promise<SyncResult> {
  const sheetMeetings = await getMeetings()

  const result: SyncResult = {
    matched: 0,
    alreadyConducted: 0,
    unmatched: 0,
    updated: [],
    unmatchedNames: [],
  }

  for (const cb of circlebackMeetings) {
    const cbAccount = extractAccount(cb.name)
    const cbDate = cb.createdAt

    // Skip non-TTT corporate meetings (no "<>" pattern)
    if (!cb.name.includes('<>') && !cb.name.toLowerCase().includes('test tribe')) {
      continue
    }

    // Find matching row in Meetings sheet
    const matchIdx = sheetMeetings.findIndex(m =>
      accountsMatch(m.accountName, cbAccount) && datesClose(m.meetingTime, cbDate)
    )

    if (matchIdx === -1) {
      result.unmatched++
      result.unmatchedNames.push(cb.name)
      continue
    }

    const sheetRow = sheetMeetings[matchIdx]
    if (sheetRow.status === 'Conducted') {
      result.alreadyConducted++
      continue
    }

    await updateMeetingConducted(matchIdx)
    sheetMeetings[matchIdx] = { ...sheetRow, status: 'Conducted' }
    result.matched++
    result.updated.push({
      account: sheetRow.accountName,
      date: sheetRow.meetingTime,
      circlebackId: cb.id,
    })
  }

  return result
}

// POST — accepts pushed meeting data (webhook) or array of meetings
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { meetings?: CirclebackMeeting[] } | CirclebackMeeting
    const meetings: CirclebackMeeting[] = Array.isArray(body)
      ? body
      : 'meetings' in body && Array.isArray(body.meetings)
        ? body.meetings
        : [body as CirclebackMeeting]

    const result = await syncMeetings(meetings)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[circleback-sync POST]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// GET — fetches from Circleback API and syncs (requires CIRCLEBACK_API_KEY)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const days = Number(url.searchParams.get('days') ?? '7')

    const to = new Date()
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
    const fromStr = from.toISOString().slice(0, 10)
    const toStr   = to.toISOString().slice(0, 10)

    const cbMeetings = await fetchCirclebackMeetings(fromStr, toStr)
    const result = await syncMeetings(cbMeetings)
    return NextResponse.json({ ok: true, fetched: cbMeetings.length, ...result })
  } catch (err) {
    console.error('[circleback-sync GET]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
