// One-time script: seeds Payments sheet with 8 historical invoices.
// Run with: node scripts/seed-payments.mjs
import { readFileSync } from 'fs'
import { google } from 'googleapis'

// Load .env.local manually
const envLines = readFileSync('.env.local', 'utf8').split('\n')
const env = {}
for (const line of envLines) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
}

const SPREADSHEET_ID = env.SHEETS_SPREADSHEET_ID
const GOOGLE_SERVICE_ACCOUNT_EMAIL = env.GOOGLE_SERVICE_ACCOUNT_EMAIL
const GOOGLE_PRIVATE_KEY = env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!SPREADSHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
  console.error('Missing required env vars: SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY')
  process.exit(1)
}

const auth = new google.auth.GoogleAuth({
  credentials: { client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: GOOGLE_PRIVATE_KEY },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})
const sheets = google.sheets({ version: 'v4', auth })

const ROWS = [
  ['2026-02-10', 'RxLogix Corporation India Private Limited', 'RxLogix AI/ML Training – AI Foundations (advance)', 441000, '2026-02-10', '2026-02-10', 'Invoiced', 'Invoice TTT-227', ''],
  ['2026-03-16', 'RxLogix Corporation India Private Limited', 'RxLogix AI/ML Training – AI Foundations (balance)', 189000, '2026-03-16', '2026-03-20', 'Invoiced', 'Invoice TTT-233', ''],
  ['2026-03-18', 'RxLogix Corporation India Private Limited', 'RxLogix BQA Upskilling (70%)', 338800, '2026-03-18', '2026-03-25', 'Invoiced', 'Invoice TTT-234', ''],
  ['2026-04-20', 'RxLogix Corporation India Private Limited', 'RxLogix BQA Upskilling (30% balance)', 145200, '2026-04-20', '2026-04-27', 'Invoiced', 'Invoice TTT-239', ''],
  ['2026-05-18', 'Tungsten Development Private Limited', 'Tungsten QA Upskilling – 20h', 285986, '2026-05-18', '2026-05-25', 'Invoiced', 'Invoice TTT-246', ''],
  ['2026-05-06', 'Wartsila India Private Limited', 'Wartsila Agentic AI Training (70%)', 89250, '2026-05-06', '2026-05-12', 'Invoiced', 'Invoice TTT-248', ''],
  ['2026-02-18', 'Betterworks Inc', 'Betterworks AI Agents in QA', 2376, '2026-02-18', '2026-02-20', 'Invoiced', 'Invoice BW-00001 (USD – $2,494.80 incl. cross-border charge)', ''],
  ['2026-06-09', 'ExaThought', 'ExaThought Agentic AI Training – 8h', 52000, '', '', 'Invoiced', 'Proforma/Quote (no formal invoice number)', ''],
]

async function main() {
  // Ensure Payments tab exists
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const exists = meta.data.sheets?.some(s => s.properties?.title === 'Payments')
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Payments' } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Payments!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['Date', 'Account', 'Deal', 'Amount', 'Invoice Date', 'Due Date', 'Status', 'Notes', 'Attachment URL']] },
    })
    console.log('Created Payments tab')
  }

  // Read existing notes to detect duplicates
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Payments!H:H' })
  const existingNotes = new Set((existing.data.values ?? []).flat().map(v => String(v)))

  let written = 0, skipped = 0
  for (const row of ROWS) {
    const note = row[7]
    if (existingNotes.has(note)) {
      console.log(`SKIP  ${note}`)
      skipped++
      continue
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Payments!A:I',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    })
    console.log(`WROTE ${note}`)
    existingNotes.add(note)
    written++
  }

  console.log(`\nDone. Written: ${written}, Skipped: ${skipped}`)
}

main().catch(e => { console.error(e); process.exit(1) })
