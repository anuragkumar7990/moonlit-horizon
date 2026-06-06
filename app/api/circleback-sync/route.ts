import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getMeetings, updateMeetingConducted, appendNoteRow, getNotes } from '@/lib/sheets'
import { generateAndSaveIntel, syncCirclebakIntel } from '@/lib/intel'

export const dynamic = 'force-dynamic'

interface CirclebackMeeting {
  id: number
  name: string
  createdAt: string
  notes?: string
  attendees?: { name?: string; email?: string }[]
  actionItems?: { id: number; title: string; description: string; assignee?: { name?: string; email?: string } | null; status: string }[]
}

// Extract account name from "The Test Tribe <> Account Name | Meeting Type"
function extractAccount(meetingName: string): string {
  const m = meetingName.match(/The Test Tribe\s*<>\s*(.+?)\s*[|–—]/)
  if (m) return m[1].trim()
  return meetingName.replace(/^The Test Tribe\s*(<>|–|—)?\s*/i, '').trim()
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

function accountsMatch(a: string, b: string): boolean {
  const na = normalise(a)
  const nb = normalise(b)
  return na === nb || na.includes(nb) || nb.includes(na)
}

function datesClose(d1: string, d2: string): boolean {
  try {
    const t1 = new Date(d1).getTime()
    const t2 = new Date(d2).getTime()
    return Math.abs(t1 - t2) <= 25 * 60 * 60 * 1000
  } catch { return false }
}

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  return expected === signature
}

interface SyncResult {
  matched: number
  alreadyConducted: number
  unmatched: number
  updated: { account: string; date: string; circlebackId: number }[]
  unmatchedNames: string[]
}

async function syncMeetings(meetings: CirclebackMeeting[]): Promise<SyncResult> {
  const sheetMeetings = await getMeetings()

  const result: SyncResult = { matched: 0, alreadyConducted: 0, unmatched: 0, updated: [], unmatchedNames: [] }

  for (const cb of meetings) {
    // Only process TTT corporate meetings
    if (!cb.name.includes('<>') && !cb.name.toLowerCase().includes('test tribe')) continue

    const cbAccount = extractAccount(cb.name)

    const matchIdx = sheetMeetings.findIndex(m =>
      accountsMatch(m.accountName, cbAccount) && datesClose(m.meetingTime, cb.createdAt)
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
    result.updated.push({ account: sheetRow.accountName, date: sheetRow.meetingTime, circlebackId: cb.id })

    // Write meeting notes + action items to Notes tab
    const summary = (cb.notes ?? '').slice(0, 1000)
    const actionables = (cb.actionItems ?? [])
      .map((a: { title: string; assignee?: { name?: string } | null }) => {
        const who = a.assignee?.name ? ` (${a.assignee.name})` : ''
        return `• ${a.title}${who}`
      })
      .join('\n')
    if (summary || actionables) {
      appendNoteRow({
        meetingId:   String(cb.id),
        accountName: sheetRow.accountName,
        summary,
        actionables,
        assignedTo:  '',
      }).catch(e => console.error('[circleback-sync] Notes write failed:', e))
    }

    // Update Circleback Intel layer + Last Contact Date + Cumulative
    ;(async () => {
      try {
        const allNotes = await getNotes()
        const accountNotes = allNotes.filter(n =>
          n.accountName.toLowerCase() === sheetRow.accountName.toLowerCase() && n.summary
        )
        if (accountNotes.length > 0) {
          const meetingDate = cb.createdAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
          await syncCirclebakIntel(
            sheetRow.accountName,
            accountNotes.map(n => ({ date: n.createdAt, notes: n.summary + (n.actionables ? '\n' + n.actionables : '') })),
            meetingDate
          )
        }
      } catch (e) {
        console.error('[circleback-sync] Intel refresh failed:', e)
      }
    })()
  }

  return result
}

// POST — Circleback webhook (fires after every matched meeting)
// Set up in Circleback: Automations → New → condition: invitee domain contains thetesttribe.com
// → Action: Send webhook → https://moonlit-horizon.vercel.app/api/circleback-sync
// Optional: set CIRCLEBACK_WEBHOOK_SECRET in Vercel env vars for signature verification
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    // Verify signature if secret is configured
    const secret = process.env.CIRCLEBACK_WEBHOOK_SECRET
    if (secret) {
      const sig = req.headers.get('x-signature') ?? ''
      if (!verifySignature(rawBody, sig, secret)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const body = JSON.parse(rawBody) as CirclebackMeeting | CirclebackMeeting[] | { meetings?: CirclebackMeeting[] }
    const meetings: CirclebackMeeting[] = Array.isArray(body)
      ? body
      : 'meetings' in body && Array.isArray((body as { meetings?: CirclebackMeeting[] }).meetings)
        ? (body as { meetings: CirclebackMeeting[] }).meetings
        : [body as CirclebackMeeting]

    const result = await syncMeetings(meetings)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[circleback-sync]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
