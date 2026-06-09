import { NextRequest, NextResponse } from 'next/server'
import { getSheets } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

const SECRET = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'
const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!

const NOW = new Date().toISOString()

// 4 GCal meetings from June 9 that were booked directly (not via /api/book)
// Columns: meetingId | accountName | contactName | contactEmail | meetingTime | meetingType | gMeetLink | dealId | status | createdAt
const MEETINGS = [
  ['GCAL-20260609-SAWARA',  'Sawara Solutions',                  'Chetana',              'chetanas@promilo.com',             '2026-06-09T13:00:00+05:30', 'L1', 'https://meet.google.com/xan-bupz-sak', '1321968000000961002', 'Meeting Booked', NOW],
  ['GCAL-20260609-MOBILY',  'Mobily Infotech Private Limited',   'Kiran',                'k.puravaralakshmi@mobily.com.sa',  '2026-06-09T15:00:00+05:30', 'L1', 'https://meet.google.com/zsy-tbdp-wte', '1321968000000961003', 'Meeting Booked', NOW],
  ['GCAL-20260609-BIGMINT', 'Bigmint',                           'Dipen Singh Goutam',   'dipen@bigmint.co',                 '2026-06-09T16:00:00+05:30', 'L1', 'https://meet.google.com/usc-ptun-zaj', '1321968000000961004', 'Meeting Booked', NOW],
  ['GCAL-20260609-CARNERA', 'Carnera Technologies',              'Manpreet Singh Bhikhe','manpreet@getcarnera.com',          '2026-06-09T17:00:00+05:30', 'L1', 'https://meet.google.com/wyf-fqah-cca', '1321968000000961005', 'Meeting Booked', NOW],
]

export async function POST(req: NextRequest) {
  const pwd = req.headers.get('x-dashboard-password') ?? req.nextUrl.searchParams.get('password')
  if (pwd !== SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sheets = getSheets()

  // Fetch existing meeting IDs to avoid duplicates
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Meetings!A:A' })
  const existingIds = new Set((existing.data.values ?? []).flat().filter(Boolean))

  const toInsert = MEETINGS.filter(r => !existingIds.has(r[0]))
  if (toInsert.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, message: 'All meetings already exist' })
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Meetings!A:J',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: toInsert },
  })

  return NextResponse.json({ ok: true, inserted: toInsert.length, accounts: toInsert.map(r => r[1]) })
}
