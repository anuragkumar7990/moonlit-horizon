/**
 * One-time migration: Account Intelligence 7-col → 11-col schema
 *
 * Old: Account | Updated At | Meeting Count | Last Meeting | Status | Summary | Next Action
 * New: Account | Updated At | Meeting Count | Last Meeting | Status |
 *      Email Intelligence | Circleback Intelligence | Call Intelligence |
 *      Manual Notes | Cumulative Summary | Next Action
 *
 * Migration:
 *   old F (Summary)     → new G (Circleback Intelligence)
 *   old G (Next Action) → new K (Next Action)
 *   new F, H, I, J      = '' (empty, populated later)
 */

const fs = require('fs')
const path = require('path')
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  })
}
const { google } = require('googleapis')

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID
const oauth2 = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
)
oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
const sheets = google.sheets({ version: 'v4', auth: oauth2 })

const NEW_HEADERS = [
  'Account', 'Updated At', 'Meeting Count', 'Last Meeting', 'Status',
  'Email Intelligence', 'Circleback Intelligence', 'Call Intelligence',
  'Manual Notes', 'Cumulative Summary', 'Next Action',
]

async function migrate() {
  console.log('Reading current Account Intelligence tab...')
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Account Intelligence!A:K',
  })
  const rows = res.data.values ?? []
  if (rows.length === 0) {
    console.log('No data found — nothing to migrate.')
    return
  }

  const headerRow = rows[0]
  // Detect if already migrated by checking if col G header = 'Circleback Intelligence'
  if (headerRow[6] === 'Circleback Intelligence') {
    console.log('Already on 11-column schema. No migration needed.')
    return
  }

  console.log(`Found ${rows.length - 1} data rows. Migrating...`)

  const newRows = rows.map((r, i) => {
    if (i === 0) return NEW_HEADERS
    return [
      r[0] ?? '',  // A: Account
      r[1] ?? '',  // B: Updated At
      r[2] ?? '',  // C: Meeting Count
      r[3] ?? '',  // D: Last Meeting
      r[4] ?? '',  // E: Status
      '',          // F: Email Intelligence (new, empty)
      r[5] ?? '',  // G: Circleback Intelligence ← old Summary
      '',          // H: Call Intelligence (new, empty)
      '',          // I: Manual Notes (new, empty)
      '',          // J: Cumulative Summary (new, empty)
      r[6] ?? '',  // K: Next Action ← old Next Action
    ]
  })

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Account Intelligence!A1:K${rows.length}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: newRows },
  })

  console.log(`✅ Migrated ${rows.length - 1} accounts to 11-column schema.`)
  console.log('Next steps:')
  console.log('  1. Run /mh intel refresh <account> in Discord for any account to regenerate cumulative summaries')
  console.log('  2. Run sync-gmail script when Gmail integration is ready')
}

migrate().catch(err => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
