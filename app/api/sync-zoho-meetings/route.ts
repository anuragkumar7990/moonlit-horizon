import { NextRequest, NextResponse } from 'next/server'
import { getZohoEvents } from '@/lib/zoho'
import { getSheets } from '@/lib/sheets'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!
const CRON_SECRET = process.env.CRON_SECRET ?? ''
const PASSWORD = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'

function extractGMeetLink(description: string): string {
  const m = description.match(/https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i)
  return m?.[0] ?? ''
}

function detectMeetingType(subject: string): string {
  if (/l2|level.?2|demo|advanc/i.test(subject)) return 'L2+'
  return 'L1'
}

async function handler(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const password = req.nextUrl.searchParams.get('password')
  const isBearer = CRON_SECRET !== '' && authHeader === `Bearer ${CRON_SECRET}`
  const isPassword = password === PASSWORD
  if (!isBearer && !isPassword) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Default: look back 30 days. Pass ?since=YYYY-MM-DD for a custom window.
  const sinceParam = req.nextUrl.searchParams.get('since')
  const since = sinceParam ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const sheets = getSheets()
  const [events, existingRes] = await Promise.all([
    getZohoEvents(since),
    sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Meetings!A:A' }),
  ])

  const existingIds = new Set<string>((existingRes.data.values ?? []).flat().filter(Boolean))
  const now = new Date().toISOString()

  const newRows: string[][] = []
  for (const event of events) {
    const meetingId = `ZOHO-${event.id}`
    if (existingIds.has(meetingId)) continue
    existingIds.add(meetingId)
    newRows.push([
      meetingId,
      event.whatName || event.subject,
      event.whoName,
      '',
      event.startDateTime,
      detectMeetingType(event.subject),
      extractGMeetLink(event.description),
      '',
      'Meeting Booked',
      now,
    ])
  }

  if (newRows.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Meetings!A:J',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: newRows },
    })
  }

  return NextResponse.json({ ok: true, synced: newRows.length, skipped: events.length - newRows.length, since })
}

export const GET = handler
export const POST = handler
