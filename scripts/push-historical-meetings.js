/**
 * Pushes historical meetings from Jan-June CSV to the Meetings sheet.
 * Maps status → Meetings sheet status, generates HIST- IDs.
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

const CSV_PATH = path.join(__dirname, '..', '..', 'Others', 'Dashboard',
  'Jan-June Meetings-CT - Final Cumulative Meeting Sheet.csv')

function parseRow(line) {
  const result = []; let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++ } else inQ = !inQ }
    else if (c === ',' && !inQ) { result.push(cur); cur = '' }
    else cur += c
  }
  result.push(cur); return result
}

// DD/MM/YYYY + HH:MM → ISO datetime string in IST
function toIST(dateStr, timeStr) {
  const dm = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!dm) return ''
  const [, d, mo, yr] = dm
  const t = (timeStr || '00:00').trim()
  return `${yr}-${mo}-${d}T${t}:00+05:30`
}

// Map CSV status → Meetings sheet status
function mapStatus(csvStatus) {
  const s = (csvStatus || '').toLowerCase()
  if (s.includes('won'))                          return 'Conducted'
  if (s.includes('closed - lost'))                return 'Conducted'
  if (s.includes('not interested'))               return 'Conducted'
  if (s.includes('discussion in progress'))       return 'Conducted'
  if (s.includes('moved to pipeline'))            return 'Conducted'
  if (s.includes('lost'))                         return 'Conducted'
  if (s.includes('dropped'))                      return 'Conducted'
  if (s.includes('outline and proposal shared'))  return 'Conducted'
  if (s.includes('trainer call'))                 return 'Conducted'
  if (s.includes('cancelled'))                    return 'No Show'
  if (s.includes('no show'))                      return 'No Show'
  if (s.includes('rescheduled'))                  return 'Rescheduled'
  return 'Conducted'
}

// Map category L1/L2/L3 → meetingType
function mapType(cat) {
  const c = (cat || '').trim().toUpperCase()
  if (c === 'L2' || c === 'L3') return 'L2+'
  return 'L1'
}

async function main() {
  const raw   = fs.readFileSync(CSV_PATH, 'utf8')
  const lines = raw.split('\n').filter(l => l.trim())
  const rows  = lines.slice(1).map(parseRow)

  console.log(`📂 Loaded ${rows.length} meeting rows`)

  // Build sheet rows
  // Schema: meetingId | accountName | contactName | contactEmail | meetingTime | meetingType | gMeetLink | dealId | status | createdAt
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ')

  const sheetRows = rows
    .map((r, i) => {
      const dateStr   = (r[0]  || '').trim()  // DD/MM/YYYY
      const timeStr   = (r[3]  || '').trim()  // HH:MM
      const account   = (r[5]  || '').trim()
      const contact   = (r[6]  || '').trim()
      const email     = (r[9]  || '').trim()
      const category  = (r[10] || '').trim()
      const csvStatus = (r[11] || '').trim()

      if (!dateStr || !account) return null

      const meetingId  = `HIST-${String(i + 1).padStart(3, '0')}`
      const meetingTime = toIST(dateStr, timeStr)
      const meetingType = mapType(category)
      const status      = mapStatus(csvStatus)

      return [meetingId, account, contact, email, meetingTime, meetingType, '', '', status, now]
    })
    .filter(Boolean)

  console.log(`Writing ${sheetRows.length} rows to Meetings sheet...`)

  // Append after existing rows
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Meetings!A1',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: sheetRows },
  })

  // Summary
  const conducted  = sheetRows.filter(r => r[8] === 'Conducted').length
  const noShow     = sheetRows.filter(r => r[8] === 'No Show').length
  const rescheduled= sheetRows.filter(r => r[8] === 'Rescheduled').length

  console.log('\n── RESULTS ────────────────────────────────')
  console.log(`✅ Written: ${sheetRows.length} rows`)
  console.log(`   Conducted:   ${conducted}`)
  console.log(`   No Show:     ${noShow}`)
  console.log(`   Rescheduled: ${rescheduled}`)

  // Won accounts
  const wonRows = rows.filter(r => (r[11]||'').toLowerCase().includes('won') || (r[13]||'').toLowerCase() === 'won')
  console.log(`\n🏆 Won accounts in this dataset:`)
  const wonAccounts = [...new Set(wonRows.map(r => r[5]))]
  wonAccounts.forEach(a => console.log(`   ${a}`))
}

main().catch(err => { console.error(err); process.exit(1) })
