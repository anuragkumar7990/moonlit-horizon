/**
 * build-contact-intelligence.js
 *
 * 1. Parses DCT-v1.csv → deduplicates into unique contacts with call history
 * 2. Matches each contact to Zoho Leads/Contacts by email then phone
 * 3. Writes results to "Contact Intelligence" sheet
 *
 * Usage:
 *   node scripts/build-contact-intelligence.js
 *   node scripts/build-contact-intelligence.js --dry-run   (parse only, no Zoho/Sheets writes)
 *   node scripts/build-contact-intelligence.js --name "Hardeep Singh"  (single contact)
 */

const fs   = require('fs')
const path = require('path')

// ── Load .env.local ──────────────────────────────────────────────────────────
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

const DRY_RUN     = process.argv.includes('--dry-run')
const PREVIEW     = process.argv.includes('--preview')
const TARGET_NAME = (() => { const i = process.argv.indexOf('--name'); return i !== -1 ? process.argv[i+1] : null })()

const CSV_PATH = path.join(__dirname, '..', '..', 'CRM', 'DCT-v1-cleaned.csv')

// ── Constants ────────────────────────────────────────────────────────────────

const SHEET_NAME = 'Contact Intelligence'

const HEADERS = [
  'Zoho Lead ID', 'Zoho Contact ID', 'Zoho Account ID',
  'Name', 'Email', 'Phone', 'Title', 'Company',
  'Lead Source L1', 'Lead Source L2', 'SDR',
  'First Contact Date', 'Total Calls', 'Calls Connected', 'Connection Rate %',
  'Meeting Booked', 'Meeting Date',
  'Last Call Date', 'Last Call Outcome',
  'Current Zoho Stage',
  'Call History (JSON)',
  'Recording Links',
  'Notes Summary',
  'Updated At',
]

// ── L1 → Zoho Lvl_1_Source mapping ──────────────────────────────────────────
// Zoho values: Events | Webinar | Email | Referrals | Internal Community Data
function normaliseL1(l1raw, l2raw) {
  const r  = (l1raw  || '').trim()
  const l2 = (l2raw  || '').trim()

  // L2 overrides can clarify ambiguous L1 entries
  if (l2.includes('Revathi') || l2.includes('Kiran Chandaka') ||
      l2.includes('Aparana') || l2.includes('Ganesa') ||
      l2.includes('Anshu Tiwari') || l2.includes('Janani'))       return 'Webinar'

  if (l2.includes('Sahil Garg') || l2.includes('Tanweer') ||
      l2.includes('Siva Prasad Reddy') || l2.includes('April CT'))return 'Events'

  if (r.includes('TQ Attendee'))                                  return 'Events'
  if (r.includes('QonfX'))                                        return 'Events'
  if (r.includes('Webinar'))                                      return 'Webinar'
  if (r.includes('Corporate Training Event'))                     return 'Events'
  if (r === 'Cold - Whatsapp Community')                          return 'Events'
  if (r.includes('Cold') || r.includes('Apollo'))                 return 'Email'
  if (r.includes('Cold Email'))                                   return 'Email'
  if (r.includes('Internal') || r.includes('Community'))         return 'Internal Community Data'
  return '-None-'
}

// ── L2 → Zoho Lvl_2_Source mapping ──────────────────────────────────────────
const L2_MAP = {
  // Events
  "TribeQonf'25":                     "TribeQonf'25",
  "TribeQonf'26":                     "TribeQonf'26",
  "QonfX Hyd":                        "QonfX'25 (Hyd)",
  "QonfX'25 (Hyd)":                   "QonfX'25 (Hyd)",
  "QonfX Blr":                        "QonfX'26 (Blr)",
  "QonfX'26 (Blr)":                   "QonfX'26 (Blr)",
  // Webinars
  "Revathi's Session":                "Webinar - Fireside Chat with Revathi Chanda Syren (30.03.26)",
  "Kiran's Session":                  "Webinar - Ask Me Anything with Kiran Chandaka (15.04.26)",
  "Aparna's Session":                 "Fireside Chat with Aparana Gupta (07.04.26)",
  "Ganesa's Session":                 "Webinar - Ganesa (22.04.26)",
  // Corporate Training Events (mapped to Events L1)
  "April CT Event":                   "AI Adoption for IT Leaders - Sahil Garg (08.04.26)",
  // Unnamed webinars identified by first-contact date
  "__JAN26_WEBINAR__":                "Cutting through the BS of AI: Playwright Agents in Action - Md. Tanweer (22.01.26)",
  "__FEB26_EVENT__":                  "Boosting QA Productivity Through Copilot - Siva Prasad Reddy (24.02.26)",
  // Internal community
  "Internal Community Data":          "IntComData - As of 22.05.26",
  // Apollo
  "Email Sample Set":                 "Email Sample Set",
}

function normaliseL2(l1raw, l2raw, firstContactDate) {
  const l2 = (l2raw || '').trim()
  const l1 = (l1raw || '').trim()

  // Direct L2 mapping first
  if (L2_MAP[l2]) return L2_MAP[l2]

  // QonfX from L1 type string
  if (l1.includes('QonfX Hyd'))              return "QonfX'25 (Hyd)"
  if (l1.includes('QonfX Blr') || l1.includes('QonfX (26)')) return "QonfX'26 (Blr)"

  // TQ Attendees are all TribeQonf'25
  if (l1.includes('TQ Attendee'))            return "TribeQonf'25"

  // Unnamed Jan'26 webinar → identified by date 22/01/26
  if (l1.includes('Webinar') && firstContactDate && firstContactDate.startsWith('2026-01'))
    return "Cutting through the BS of AI: Playwright Agents in Action - Md. Tanweer (22.01.26)"

  // Unnamed Feb'26 corporate training event → identified by date 24/02/26
  if (l1.includes('Webinar') && firstContactDate && firstContactDate.startsWith('2026-02'))
    return "Boosting QA Productivity Through Copilot - Siva Prasad Reddy (24.02.26)"

  // WhatsApp Community leads treated as TribeQonf'25 Events
  if (l1 === 'Cold - Whatsapp Community')
    return "TribeQonf'25"

  // Cold outreach — check before Community to avoid substring mismatch
  if (l1.includes('Cold') || l1.includes('Apollo'))
    return "Email Sample Set"

  // Internal community
  if (l1.includes('Internal') || l1.includes('Community'))
    return "IntComData - As of 22.05.26"

  return '-None-'
}

// Parse "2nd call - picked up, meeting scheduled" into structured fields
function parseCallStatus(statusRaw) {
  if (!statusRaw || !statusRaw.trim()) return { callNumber: null, connected: false, outcome: 'Unknown', detail: '' }

  const s = statusRaw.trim().toLowerCase()

  // call number
  let callNumber = null
  const numMatch = s.match(/(\d+)(?:st|nd|rd|th)\s+call/)
  if (numMatch) callNumber = parseInt(numMatch[1])
  else if (s.includes('1st call') || s.includes('first call')) callNumber = 1
  else if (s.includes('4th call or more')) callNumber = 4

  const connected = s.includes('picked up') || s.includes('connected') || s.includes('incoming call service') || s.includes('switched off') || s.includes('wrong number') || s.includes('not the relevant') || s.includes('not able')

  let outcome = 'Unknown'
  if (s.includes('meeting scheduled') || s.includes('meeting booked') || s.includes('4th call - meeting scheduled') || s.includes('4th call or more - meeting scheduled')) outcome = 'Meeting Booked'
  else if (s.includes('not interested'))     outcome = 'Not Interested'
  else if (s.includes('send more info') || s.includes('send more information')) outcome = 'Send More Info'
  else if (s.includes('call back later') || s.includes('callback later') || s.includes('call back on') || s.includes('call later') || s.includes('call at ') || s.includes('call tomorrow') || s.includes('call next') || s.includes('call back later')) outcome = 'Callback Later'
  else if (s.includes('rnr') || s.includes('1st call - rnr') || s.includes('2nd call - rnr') || s.includes('3rd call - rnr') || s.includes('4th call - rnr') || s.includes('5th call - rnr')) outcome = 'RNR'
  else if (s.includes('wrong number'))       outcome = 'Wrong Number'
  else if (s.includes('not the relevant'))   outcome = 'Not Relevant'
  else if (s.includes('switched off'))       outcome = 'Switched Off'
  else if (s.includes('incoming call'))      outcome = 'Incoming Unavailable'
  else if (s.includes('not able'))           outcome = 'Unable to Receive'
  else if (s.includes('number invalid') || s.includes('number unavailable') || s.includes('no. out of service') || s.includes('invalid')) outcome = 'Invalid Number'
  else if (s.includes('interested'))         outcome = 'Connected - Interested'
  else if (s.includes('connected'))          outcome = 'Connected'

  return { callNumber, connected, outcome, detail: statusRaw.trim() }
}

// Normalise phone: strip spaces, leading 0/91, keep digits
function normalisePhone(raw) {
  if (!raw) return ''
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('91') && d.length > 10) d = d.slice(2)
  if (d.startsWith('0') && d.length > 10)  d = d.slice(1)
  return d.slice(-10) // last 10 digits
}

function normaliseEmail(raw) {
  if (!raw) return ''
  // Some cells have multiple emails — take the first valid one
  const parts = raw.split(/[\s,;/\n]+/)
  for (const p of parts) {
    const e = p.trim().toLowerCase()
    if (e.includes('@') && e.includes('.')) return e
  }
  return ''
}

// Parse a DD/MM/YY date string → YYYY-MM-DD
function parseDate(raw) {
  if (!raw || !raw.trim() || raw.trim() === '-') return ''
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return raw.trim()
  const [, d, mo, y] = m
  const year = y.length === 2 ? '20' + y : y
  return `${year}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
}

// ── Parse DCT CSV ────────────────────────────────────────────────────────────

function parseDCT(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8')
  const lines = raw.split('\n')

  // Header row
  const headerLine = lines[0]
  const headers = parseCSVRow(headerLine)

  // Column indices (DCT v1 layout)
  // Month,Lead Name,Lead Type,Lead Type L2,Called by,Email ID,Phone Number,
  // Title,Company,First Contact Date,Call Status,Status,Category - Call Connection Status,
  // ...,Lead ID
  const COL = {
    month:      0,
    name:       1,
    l1:         2,
    l2:         3,
    sdr:        4,
    email:      5,
    phone:      6,
    title:      7,
    company:    8,
    date:       9,
    callStatus: 10,
    notes:      11,
    connStatus: 12,
    // lead ID is last non-empty col (col S = index 19)
    leadId:     19,
  }

  // Map: composite key → contact object
  const contactMap = new Map()

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i])
    if (!row || row.length < 10) continue

    const name    = (row[COL.name]    || '').trim()
    const email   = normaliseEmail(row[COL.email] || '')
    const phone   = normalisePhone(row[COL.phone] || '')
    const company = (row[COL.company] || '').trim()

    if (!name && !email && !phone) continue
    if (name.toLowerCase().startsWith('tribe') || name === '') continue

    // Unique key: prefer email, fall back to phone, then name+company
    const key = email || phone || `${name.toLowerCase()}|${company.toLowerCase()}`

    const l1raw = (row[COL.l1] || '').trim()
    const l2raw = (row[COL.l2] || '').trim()
    const sdr   = (row[COL.sdr] || '').trim()
    const date  = parseDate(row[COL.date] || '')
    const callStatusRaw = (row[COL.callStatus] || '').trim()
    const notesRaw      = (row[COL.notes]      || '').trim()
    const connStatus    = (row[COL.connStatus]  || '').trim()

    const parsed = parseCallStatus(callStatusRaw)

    // Extract meeting date from notes if meeting booked
    let meetingDate = ''
    if (parsed.outcome === 'Meeting Booked') {
      const mdm = notesRaw.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/)
      if (mdm) {
        const d = mdm[1].padStart(2,'0')
        const m = mdm[2].padStart(2,'0')
        const y = mdm[3] ? (mdm[3].length === 2 ? '20'+mdm[3] : mdm[3]) : '2025'
        meetingDate = `${y}-${m}-${d}`
      }
    }

    const callEntry = {
      month:       (row[COL.month] || '').trim(),
      date,
      sdr,
      callNumber:  parsed.callNumber,
      connected:   parsed.connected,
      outcome:     parsed.outcome,
      detail:      parsed.detail,
      notes:       notesRaw,
      meetingDate,
    }

    if (contactMap.has(key)) {
      const c = contactMap.get(key)
      c.callHistory.push(callEntry)
      // Update email/phone if we now have them
      if (!c.email && email) c.email = email
      if (!c.phone && phone) c.phone = phone
      // Keep earliest first contact date
      if (date && (!c.firstContactDate || date < c.firstContactDate)) c.firstContactDate = date
      // Update meeting booked
      if (parsed.outcome === 'Meeting Booked') {
        c.meetingBooked = true
        if (meetingDate && (!c.meetingDate || meetingDate < c.meetingDate)) c.meetingDate = meetingDate
      }
    } else {
      contactMap.set(key, {
        key,
        name,
        email,
        phone,
        title:    (row[COL.title]   || '').trim(),
        company,
        l1:       normaliseL1(l1raw, l2raw),
        l2:       normaliseL2(l1raw, l2raw, date),
        sdr,
        firstContactDate: date,
        meetingBooked:    parsed.outcome === 'Meeting Booked',
        meetingDate,
        callHistory: [callEntry],
        // Zoho fields (filled later)
        zohoLeadId:    '',
        zohoContactId: '',
        zohoAccountId: '',
        zohoStage:     '',
      })
    }
  }

  return contactMap
}

// Minimal CSV parser (handles quoted fields)
function parseCSVRow(line) {
  if (!line || !line.trim()) return null
  const result = []
  let cur = '', inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuote && line[i+1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (c === ',' && !inQuote) {
      result.push(cur); cur = ''
    } else {
      cur += c
    }
  }
  result.push(cur)
  return result
}

// ── Zoho Matching ────────────────────────────────────────────────────────────

async function getZohoToken() {
  const res = await fetch(
    `https://accounts.zoho.in/oauth/v2/token?refresh_token=${process.env.ZOHO_REFRESH_TOKEN}&client_id=${process.env.ZOHO_CLIENT_ID}&client_secret=${process.env.ZOHO_CLIENT_SECRET}&grant_type=refresh_token`,
    { method: 'POST' }
  )
  const data = await res.json()
  if (!data.access_token) throw new Error(`Zoho token error: ${JSON.stringify(data)}`)
  return data.access_token
}

async function zohoSearchByEmail(token, email, module = 'Leads') {
  const url = `https://www.zohoapis.in/crm/v2/${module}/search?email=${encodeURIComponent(email)}`
  const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } })
  if (res.status === 204) return null
  const data = await res.json()
  return data.data?.[0] ?? null
}

async function zohoSearchByPhone(token, phone, module = 'Leads') {
  const url = `https://www.zohoapis.in/crm/v2/${module}/search?phone=${encodeURIComponent(phone)}`
  const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } })
  if (res.status === 204) return null
  const data = await res.json()
  return data.data?.[0] ?? null
}

async function matchToZoho(contact, token) {
  const result = { zohoLeadId: '', zohoContactId: '', zohoAccountId: '', zohoStage: '', matched: false }

  // 1. Try Leads by email
  if (contact.email) {
    const lead = await zohoSearchByEmail(token, contact.email, 'Leads')
    if (lead) {
      result.zohoLeadId = lead.id
      result.zohoStage  = lead.Lead_Status || lead.Lead_Source || ''
      result.matched    = true

      // Check if converted → get Contact
      if (lead.Converted) {
        const contact2 = await zohoSearchByEmail(token, contact.email, 'Contacts')
        if (contact2) {
          result.zohoContactId = contact2.id
          result.zohoAccountId = contact2.Account_Name?.id || ''
        }
      }
      return result
    }
  }

  // 2. Try Contacts by email (already converted, Lead record may be gone)
  if (contact.email) {
    const ct = await zohoSearchByEmail(token, contact.email, 'Contacts')
    if (ct) {
      result.zohoContactId = ct.id
      result.zohoAccountId = ct.Account_Name?.id || ''
      result.zohoStage     = 'Converted'
      result.matched       = true
      return result
    }
  }

  // 3. Try Leads by phone
  if (contact.phone) {
    const lead = await zohoSearchByPhone(token, contact.phone, 'Leads')
    if (lead) {
      result.zohoLeadId = lead.id
      result.zohoStage  = lead.Lead_Status || ''
      result.matched    = true
      if (lead.Converted) {
        const contact2 = await zohoSearchByPhone(token, contact.phone, 'Contacts')
        if (contact2) {
          result.zohoContactId = contact2.id
          result.zohoAccountId = contact2.Account_Name?.id || ''
        }
      }
      return result
    }
  }

  // 4. Try Contacts by phone
  if (contact.phone) {
    const ct = await zohoSearchByPhone(token, contact.phone, 'Contacts')
    if (ct) {
      result.zohoContactId = ct.id
      result.zohoAccountId = ct.Account_Name?.id || ''
      result.zohoStage     = 'Converted'
      result.matched       = true
    }
  }

  return result
}

// ── Google Sheets ────────────────────────────────────────────────────────────

async function ensureSheet() {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const existing = meta.data.sheets.find(s => s.properties.title === SHEET_NAME)
  if (!existing) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: SHEET_NAME } } }]
      }
    })
    console.log(`Created sheet: ${SHEET_NAME}`)
  }
}

async function writeHeaders() {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [HEADERS] },
  })
}

async function appendRows(rows) {
  if (rows.length === 0) return
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  })
}

// ── Stats helpers ────────────────────────────────────────────────────────────

function computeStats(contact) {
  const hist = contact.callHistory
  const total     = hist.length
  const connected = hist.filter(c => c.connected).length
  const rate      = total > 0 ? Math.round((connected / total) * 100) : 0

  // Last call = last entry by date or array order
  const sorted = [...hist].sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return b.date.localeCompare(a.date)
  })
  const last = sorted[0]

  const meetingBooked = hist.some(c => c.outcome === 'Meeting Booked') ? 'Yes' : 'No'
  const meetingDate   = hist.reduce((acc, c) => c.meetingDate && (!acc || c.meetingDate < acc) ? c.meetingDate : acc, '')

  return { total, connected, rate, last, meetingBooked, meetingDate }
}

function contactToRow(contact, zoho) {
  const stats = computeStats(contact)
  const now   = new Date().toISOString().slice(0, 16).replace('T', ' ')

  return [
    zoho.zohoLeadId,
    zoho.zohoContactId,
    zoho.zohoAccountId,
    contact.name,
    contact.email,
    contact.phone,
    contact.title,
    contact.company,
    contact.l1,
    contact.l2,
    contact.callHistory.map(c => c.sdr).find(s => s) || '',
    contact.firstContactDate,
    stats.total,
    stats.connected,
    stats.rate,
    stats.meetingBooked,
    stats.meetingDate,
    stats.last?.date || '',
    stats.last?.outcome || '',
    zoho.zohoStage,
    JSON.stringify(contact.callHistory),
    '',   // Recording Links — to be enriched later
    '',   // Notes Summary — to be enriched later
    now,
  ]
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📂 Parsing DCT v1...')
  const contactMap = parseDCT(CSV_PATH)
  let contacts = [...contactMap.values()]

  if (TARGET_NAME) {
    contacts = contacts.filter(c => c.name.toLowerCase().includes(TARGET_NAME.toLowerCase()))
    console.log(`🔍 Filtered to ${contacts.length} contact(s) matching "${TARGET_NAME}"`)
  }

  console.log(`\n✅ Parsed ${contacts.length} unique contacts from ${[...contactMap.values()].reduce((s,c) => s + c.callHistory.length, 0)} rows`)

  // Stats
  const meetingCount = contacts.filter(c => c.meetingBooked).length
  const withEmail    = contacts.filter(c => c.email).length
  const withPhone    = contacts.filter(c => c.phone).length
  console.log(`   • With email: ${withEmail}`)
  console.log(`   • With phone: ${withPhone}`)
  console.log(`   • Meeting booked: ${meetingCount}`)

  if (DRY_RUN) {
    console.log('\n🔶 DRY RUN — no Zoho/Sheets writes. Sample output:')
    contacts.slice(0, 5).forEach(c => {
      const s = computeStats(c)
      console.log(`\n  ${c.name} | ${c.company}`)
      console.log(`    L1: ${c.l1}  L2: ${c.l2}  SDR: ${c.callHistory[0]?.sdr}`)
      console.log(`    Calls: ${s.total}  Connected: ${s.connected}  Rate: ${s.rate}%  Meeting: ${s.meetingBooked}`)
      console.log(`    Last: ${s.last?.date} → ${s.last?.outcome}`)
    })
    return
  }

  // ── PREVIEW MODE: Zoho match 20 sample contacts, print results, no Sheets write ──
  if (PREVIEW) {
    console.log('\n🔬 PREVIEW MODE — Zoho matching 20 sample contacts (no Sheets write)\n')
    const token = await getZohoToken()
    console.log('Zoho token OK\n')

    // Sample: first 5 with email, first 5 without email (phone only), 5 meeting-booked, 5 random
    const withEmail    = contacts.filter(c => c.email).slice(0, 5)
    const phoneOnly    = contacts.filter(c => !c.email && c.phone).slice(0, 5)
    const meetingBooked = contacts.filter(c => c.meetingBooked).slice(0, 5)
    const random       = contacts.slice(100, 105)
    const sample       = [...new Map([...withEmail, ...phoneOnly, ...meetingBooked, ...random].map(c => [c.key, c])).values()]

    let matched = 0, unmatched = 0

    // L1 breakdown
    const l1counts = {}
    contacts.forEach(c => { l1counts[c.l1] = (l1counts[c.l1] || 0) + 1 })
    console.log('📊 Lead Source L1 breakdown:')
    Object.entries(l1counts).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`   ${k.padEnd(35)} ${v}`))

    // Outcome breakdown
    const outcomeCounts = {}
    contacts.forEach(c => c.callHistory.forEach(h => { outcomeCounts[h.outcome] = (outcomeCounts[h.outcome] || 0) + 1 }))
    console.log('\n📞 Call Outcome breakdown (all calls):')
    Object.entries(outcomeCounts).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`   ${k.padEnd(35)} ${v}`))

    // Multi-call contacts
    const multiCall = contacts.filter(c => c.callHistory.length > 1)
    console.log(`\n🔁 Re-called contacts: ${multiCall.length} (avg ${(multiCall.reduce((s,c) => s+c.callHistory.length,0)/multiCall.length).toFixed(1)} calls each)`)

    // SDR breakdown
    const sdrCounts = {}
    contacts.forEach(c => { const sdr = c.callHistory[0]?.sdr || 'Unknown'; sdrCounts[sdr] = (sdrCounts[sdr] || 0) + 1 })
    console.log('\n👤 SDR breakdown:')
    Object.entries(sdrCounts).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`   ${k.padEnd(35)} ${v}`))

    console.log('\n─────────────────────────────────────────────────────')
    console.log('🔗 Sample Zoho matches:\n')

    for (const contact of sample) {
      process.stdout.write(`  Matching ${contact.name} (${contact.email || contact.phone})... `)
      const zoho = await matchToZoho(contact, token)
      const s = computeStats(contact)
      if (zoho.matched) {
        matched++
        const id = zoho.zohoLeadId || zoho.zohoContactId
        const type = zoho.zohoLeadId ? (zoho.zohoContactId ? 'Lead+Contact' : 'Lead') : 'Contact'
        console.log(`✅ ${type} ${id} | Stage: ${zoho.zohoStage || '—'}`)
      } else {
        unmatched++
        console.log(`❌ No match`)
      }
      console.log(`     ${contact.name} | ${contact.company} | ${contact.l1}`)
      console.log(`     Calls: ${s.total} | Connected: ${s.connected} | Meeting: ${s.meetingBooked} | Last: ${s.last?.date} → ${s.last?.outcome}`)
    }

    console.log(`\n─────────────────────────────────────────────────────`)
    console.log(`Sample match rate: ${matched}/${sample.length} (${Math.round(matched/sample.length*100)}%)`)
    console.log(`\nIf match rate looks good, run without --preview to write all ${contacts.length} contacts to the sheet.`)
    return
  }

  // Zoho matching
  console.log('\n🔗 Matching to Zoho CRM...')
  const token = await getZohoToken()
  console.log('Zoho token OK')

  const rows      = []
  let matched     = 0
  let unmatched   = 0
  const BATCH     = 50  // Zoho rate limit buffer

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i]
    process.stdout.write(`\r[${i+1}/${contacts.length}] ${contact.name.padEnd(40)}`)

    let zoho = { zohoLeadId: '', zohoContactId: '', zohoAccountId: '', zohoStage: '', matched: false }

    try {
      zoho = await matchToZoho(contact, token)
      if (zoho.matched) matched++
      else unmatched++
    } catch (e) {
      console.error(`\n  Error matching ${contact.name}: ${e.message}`)
      unmatched++
    }

    rows.push(contactToRow(contact, zoho))

    // Rate limit: Zoho allows 200 req/min, we do up to 4 calls per contact → ~50/min safe
    if ((i + 1) % BATCH === 0) {
      await new Promise(r => setTimeout(r, 15000)) // 15s pause every 50 contacts
    }
  }

  console.log(`\n\n✅ Zoho matched: ${matched} | Unmatched: ${unmatched}`)

  // Write to sheet
  console.log('\n📊 Writing to Google Sheets...')
  await ensureSheet()
  await writeHeaders()

  // Write in chunks of 500 rows
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    await appendRows(rows.slice(i, i + CHUNK))
    console.log(`  Wrote rows ${i+1}–${Math.min(i+CHUNK, rows.length)}`)
  }

  console.log(`\n🎉 Done. ${rows.length} contacts written to "${SHEET_NAME}" tab.`)
  console.log(`   Matched to Zoho: ${matched} (${Math.round(matched/rows.length*100)}%)`)
  console.log(`   Unmatched: ${unmatched} — these need manual Zoho ID lookup`)
}

main().catch(err => { console.error(err); process.exit(1) })
