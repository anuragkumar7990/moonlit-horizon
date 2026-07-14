/**
 * READ-ONLY data-quality report across all (non-converted) Zoho Leads — phone AND email.
 * Pulls live from Zoho CRM via the same ZOHO_REFRESH_TOKEN/CLIENT_ID/CLIENT_SECRET the
 * deployed app uses (read from .env.local) — not Sheets, not a CSV, the actual current
 * records in the CRM. Makes NO changes to Zoho. Writes prospect-data-issues-report.csv.
 *
 * Phone: same normalisation rule as app/api/upload-prospects/route.ts's normalisePhone.
 * Email: flags missing, malformed (fails a basic RFC-shape check), and duplicates (same
 * email used across more than one Lead — a real CRM mess, not just a formatting issue).
 *
 * Run: node scripts/report-prospect-data-issues.js
 */

const fs   = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env.local')
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
})

const BASE_URL = 'https://www.zohoapis.in/crm/v3'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function getZohoToken() {
  const res = await fetch(
    `https://accounts.zoho.in/oauth/v2/token?refresh_token=${process.env.ZOHO_REFRESH_TOKEN}&client_id=${process.env.ZOHO_CLIENT_ID}&client_secret=${process.env.ZOHO_CLIENT_SECRET}&grant_type=refresh_token`,
    { method: 'POST' }
  )
  const data = await res.json()
  if (!data.access_token) throw new Error(`Zoho token error: ${JSON.stringify(data)}`)
  return data.access_token
}

// Same cleaning rule as app/api/upload-prospects/route.ts's normalisePhone — kept in sync
// manually; this is a one-off cleanup tool, not part of the live request path, so
// duplicating the small function here (rather than importing the TS module from a plain
// Node script) is the lower-risk option.
function normalisePhone(val) {
  let digits = String(val || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  if (digits.length === 13 && digits.startsWith('091')) digits = digits.slice(3)
  if (digits.length !== 10) return null
  return `+91${digits}`
}

async function getAllLeads(token) {
  const results = []
  let page = 1
  while (page <= 50) {
    const res = await fetch(
      `${BASE_URL}/Leads?fields=First_Name,Last_Name,Email,Phone,Mobile,Company,Converted__s&per_page=200&page=${page}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    )
    const data = await res.json()
    const rows = data.data ?? []
    for (const l of rows) {
      if (l.Converted__s) continue // converted leads are Contacts now — out of scope here
      results.push(l)
    }
    if (!data.info?.more_records || rows.length < 200) break
    page++
  }
  return results
}

function csvEscape(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function main() {
  console.log('Fetching Zoho token...')
  const token = await getZohoToken()
  console.log('Fetching all Leads from live Zoho CRM (this may take a minute)...')
  const leads = await getAllLeads(token)
  console.log(`Loaded ${leads.length} (non-converted) Leads.\n`)

  const rows = [['Lead ID', 'Name', 'Company', 'Field', 'Current Value', 'Issue', 'Proposed Clean Value']]
  const phoneStats = { missing: 0, fixable: 0, malformed: 0, clean: 0 }
  const emailStats = { missing: 0, malformed: 0, clean: 0 }
  const emailCounts = new Map() // email -> count, for duplicate detection

  for (const l of leads) {
    const email = (l.Email || '').trim().toLowerCase()
    if (email) emailCounts.set(email, (emailCounts.get(email) || 0) + 1)
  }

  for (const l of leads) {
    const name = `${l.First_Name ?? ''} ${l.Last_Name ?? ''}`.trim()
    const company = l.Company ?? ''

    // --- Phone ---
    const rawPhone = l.Mobile || l.Phone || ''
    const phoneField = l.Mobile ? 'Mobile' : (l.Phone ? 'Phone' : 'Mobile')
    if (!rawPhone.trim()) {
      phoneStats.missing++
      rows.push([l.id, name, company, phoneField, '', 'PHONE MISSING', ''])
    } else {
      const cleaned = normalisePhone(rawPhone)
      if (!cleaned) {
        phoneStats.malformed++
        rows.push([l.id, name, company, phoneField, rawPhone, 'PHONE MALFORMED — cannot auto-fix, needs manual review', ''])
      } else if (cleaned !== rawPhone) {
        phoneStats.fixable++
        rows.push([l.id, name, company, phoneField, rawPhone, 'PHONE FIXABLE — will be normalised', cleaned])
      } else {
        phoneStats.clean++
      }
    }

    // --- Email ---
    const rawEmail = (l.Email || '').trim()
    if (!rawEmail) {
      emailStats.missing++
      rows.push([l.id, name, company, 'Email', '', 'EMAIL MISSING', ''])
    } else if (!EMAIL_RE.test(rawEmail)) {
      emailStats.malformed++
      rows.push([l.id, name, company, 'Email', rawEmail, 'EMAIL MALFORMED — needs manual review', ''])
    } else {
      emailStats.clean++
      const dupCount = emailCounts.get(rawEmail.toLowerCase())
      if (dupCount > 1) {
        rows.push([l.id, name, company, 'Email', rawEmail, `EMAIL DUPLICATE — used by ${dupCount} Leads`, ''])
      }
    }
  }

  const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n')
  const outPath = path.join(__dirname, '..', 'prospect-data-issues-report.csv')
  fs.writeFileSync(outPath, csv)

  console.log('--- Prospect Data Quality Report (live Zoho Leads) ---')
  console.log(`Total Leads checked: ${leads.length}\n`)
  console.log('Phone:')
  console.log(`  Already clean:  ${phoneStats.clean}`)
  console.log(`  Missing:        ${phoneStats.missing}`)
  console.log(`  Fixable:        ${phoneStats.fixable}`)
  console.log(`  Malformed:      ${phoneStats.malformed}\n`)
  console.log('Email:')
  console.log(`  Clean:          ${emailStats.clean}`)
  console.log(`  Missing:        ${emailStats.missing}`)
  console.log(`  Malformed:      ${emailStats.malformed}`)
  console.log(`\nFull report written to: ${outPath}`)
  console.log('Review it, then run scripts/fix-phone-numbers.js --commit to apply the PHONE FIXABLE rows.')
  console.log('MISSING/MALFORMED rows need manual review or cross-referencing against the historical CRM/ CSVs.')
}

main().catch(err => { console.error(err); process.exit(1) })
