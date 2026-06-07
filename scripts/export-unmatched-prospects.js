/**
 * Reads Contact Intelligence sheet, extracts rows with no Zoho match,
 * and appends them to CRM/never-called-prospects.csv as uploadable prospects.
 */

const fs   = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env.local')
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
})

const { google } = require('googleapis')
const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID

const oauth2 = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
)
oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
const sheets = google.sheets({ version: 'v4', auth: oauth2 })

const OUT_PATH     = path.join(__dirname, '..', '..', 'CRM', 'unmatched-prospects.csv')
const NEVER_CALLED = path.join(__dirname, '..', '..', 'CRM', 'never-called-prospects.csv')

// CSV headers for the prospects output
const PROSPECT_HEADERS = [
  'Name', 'Email', 'Phone', 'Title', 'Company',
  'Lead Source L1', 'Lead Source L2', 'SDR',
  'First Contact Date', 'Total Calls', 'Connection Rate %',
  'Meeting Booked', 'Last Call Date', 'Last Call Outcome',
  'Notes'
].join(',')

function escapeCSV(val) {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

async function main() {
  console.log('Reading Contact Intelligence sheet...')
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Contact Intelligence!A:W',
  })

  const rows = res.data.values || []
  if (rows.length < 2) { console.log('No data found.'); return }

  const header = rows[0]
  // Col indices based on HEADERS array from build script
  // A=0:ZohoLeadId B=1:ZohoContactId C=2:ZohoAccountId D=3:Name E=4:Email
  // F=5:Phone G=6:Title H=7:Company I=8:L1 J=9:L2 K=10:SDR
  // L=11:FirstContactDate M=12:TotalCalls N=13:Connected O=14:ConnRate%
  // P=15:MeetingBooked Q=16:MeetingDate R=17:LastCallDate S=18:LastCallOutcome
  // T=19:ZohoStage U=20:CallHistoryJSON V=21:RecordingLinks W=22:NotesSummary

  const data = rows.slice(1)

  // Filter: no Zoho Lead ID AND no Zoho Contact ID
  const unmatched = data.filter(r => !r[0] && !r[1])

  console.log(`Total rows: ${data.length}`)
  console.log(`Unmatched (no Zoho ID): ${unmatched.length}`)

  // Build prospect CSV rows
  const prospectRows = [PROSPECT_HEADERS]
  for (const r of unmatched) {
    // Skip if no email and no phone
    const email = r[4] || ''
    const phone = r[5] || ''
    if (!email && !phone) continue

    // Extract a readable notes snippet from call history JSON
    let noteSnippet = ''
    try {
      const hist = JSON.parse(r[20] || '[]')
      const lastCall = hist[hist.length - 1]
      if (lastCall) noteSnippet = lastCall.detail || lastCall.notes || ''
    } catch {}

    prospectRows.push([
      r[3],   // Name
      r[4],   // Email
      r[5],   // Phone
      r[6],   // Title
      r[7],   // Company
      r[8],   // L1
      r[9],   // L2
      r[10],  // SDR
      r[11],  // First Contact Date
      r[12],  // Total Calls
      r[14],  // Connection Rate %
      r[15],  // Meeting Booked
      r[17],  // Last Call Date
      r[18],  // Last Call Outcome
      noteSnippet,
    ].map(escapeCSV).join(','))
  }

  fs.writeFileSync(OUT_PATH, prospectRows.join('\n'), 'utf8')
  console.log(`\n✅ Written ${prospectRows.length - 1} unmatched prospects to:`)
  console.log(`   ${OUT_PATH}`)

  // Breakdown by Last Call Outcome
  const outcomes = {}
  unmatched.forEach(r => {
    const o = r[18] || 'Unknown'
    outcomes[o] = (outcomes[o] || 0) + 1
  })
  console.log('\nBreakdown by last call outcome:')
  Object.entries(outcomes).sort((a,b) => b[1]-a[1]).forEach(([k,v]) =>
    console.log(`  ${k.padEnd(30)} ${v}`)
  )

  // Breakdown by L1 source
  const sources = {}
  unmatched.forEach(r => {
    const s = r[8] || 'Unknown'
    sources[s] = (sources[s] || 0) + 1
  })
  console.log('\nBreakdown by L1 source:')
  Object.entries(sources).sort((a,b) => b[1]-a[1]).forEach(([k,v]) =>
    console.log(`  ${k.padEnd(30)} ${v}`)
  )

  console.log('\nNote: These contacts were called but have no Zoho Lead record.')
  console.log('They can be uploaded to Zoho Leads via the Upload Prospects flow.')
}

main().catch(err => { console.error(err); process.exit(1) })
