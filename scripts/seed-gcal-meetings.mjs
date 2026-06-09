/**
 * One-time script: seeds 4 Google Calendar meetings (June 9) that were
 * booked directly in GCal and never went through /api/book.
 * Run with: node scripts/seed-gcal-meetings.mjs
 */
import { readFileSync } from 'fs'
import { google } from 'googleapis'

// Parse .env.local — handle quoted values and skip blank/comment lines
const envText = readFileSync('.env.local', 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (!m) continue
  let val = m[2].trim()
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1)
  }
  process.env[m[1]] = val
}

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID
if (!SPREADSHEET_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
  console.error('Missing env vars. SPREADSHEET_ID:', !!SPREADSHEET_ID, 'REFRESH_TOKEN:', !!process.env.GOOGLE_REFRESH_TOKEN)
  process.exit(1)
}
const oauth2 = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
const sheets = google.sheets({ version: 'v4', auth: oauth2 })

const NOW = new Date().toISOString()

// Columns: meetingId | accountName | contactName | contactEmail | meetingTime | meetingType | gMeetLink | dealId | status | createdAt
const MEETINGS = [
  ['GCAL-20260609-SAWARA',  'Sawara Solutions',                  'Chetana',             'chetanas@promilo.com',              '2026-06-09T13:00:00+05:30', 'L1', 'https://meet.google.com/xan-bupz-sak', '1321968000000961002', 'Meeting Booked', NOW],
  ['GCAL-20260609-MOBILY',  'Mobily Infotech Private Limited',   'Kiran',               'k.puravaralakshmi@mobily.com.sa',   '2026-06-09T15:00:00+05:30', 'L1', 'https://meet.google.com/zsy-tbdp-wte', '1321968000000961003', 'Meeting Booked', NOW],
  ['GCAL-20260609-BIGMINT', 'Bigmint',                           'Dipen Singh Goutam',  'dipen@bigmint.co',                  '2026-06-09T16:00:00+05:30', 'L1', 'https://meet.google.com/usc-ptun-zaj', '1321968000000961004', 'Meeting Booked', NOW],
  ['GCAL-20260609-CARNERA', 'Carnera Technologies',              'Manpreet Singh Bhikhe','manpreet@getcarnera.com',           '2026-06-09T17:00:00+05:30', 'L1', 'https://meet.google.com/wyf-fqah-cca', '1321968000000961005', 'Meeting Booked', NOW],
]

// Check existing meetingIds to avoid duplicates
const existing = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Meetings!A:A' })
const existingIds = new Set((existing.data.values ?? []).flat().filter(Boolean))

const toInsert = MEETINGS.filter(r => !existingIds.has(r[0]))
if (toInsert.length === 0) {
  console.log('All meetings already exist in sheet — nothing to insert.')
  process.exit(0)
}

await sheets.spreadsheets.values.append({
  spreadsheetId: SPREADSHEET_ID,
  range: 'Meetings!A:J',
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: toInsert },
})

console.log(`Inserted ${toInsert.length} meeting(s):`)
toInsert.forEach(r => console.log(`  ${r[0]} — ${r[1]} @ ${r[4]}`))
