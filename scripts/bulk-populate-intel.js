/**
 * Bulk-populate Account Intelligence sheet from all Zoho CRM accounts.
 * Adds any Zoho account not already in the sheet as a Cold row, then
 * runs Gmail sync for every newly added account.
 *
 * Run: node scripts/bulk-populate-intel.js
 */

const fs   = require('fs')
const path = require('path')

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  })
}

const { google } = require('googleapis')

const SPREADSHEET_ID     = process.env.SHEETS_SPREADSHEET_ID
const VERCEL_URL         = 'https://moonlit-horizon.vercel.app'
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'thetesttribe'

const oauth2 = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
)
oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })

const sheets = google.sheets({ version: 'v4', auth: oauth2 })
const gmail  = google.gmail({ version: 'v1', auth: oauth2 })

// ── Junk/test account filter ──────────────────────────────────────────────────

const JUNK_ACCOUNTS = new Set([
  'test', 'test1', 'testing', 'testfinal', 'discord bot',
  'confidential', 'meril.jacob@ltimindtree.com',
])

function isJunk(name) {
  return JUNK_ACCOUNTS.has(name.toLowerCase().trim())
}

// ── Normalise account name for dedup/matching ─────────────────────────────────

const STRIP = /\b(pvt|ltd|llc|inc|private|limited|india|pvt\.?\s*ltd\.?|india\s+pvt|technologies|technology|solutions|software|systems|group|services|consulting|infotech|infosystems|enterprises|ventures|outdoor|outdoor india)\b\.?/gi

function norm(name) {
  return name
    .replace(/\(.*?\)/g, '')   // strip parentheticals
    .replace(STRIP, '')
    .replace(/[^a-z0-9\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// Returns true if two account names refer to the same company
function isSameAccount(a, b) {
  const na = norm(a)
  const nb = norm(b)
  if (na === nb) return true
  // one contains the other (handles "Wartsila" vs "Wartsila India")
  if (na.length >= 4 && nb.startsWith(na)) return true
  if (nb.length >= 4 && na.startsWith(nb)) return true
  return false
}

// ── Zoho CRM ──────────────────────────────────────────────────────────────────

async function getZohoToken() {
  const res = await fetch(
    `https://accounts.zoho.in/oauth/v2/token?refresh_token=${process.env.ZOHO_REFRESH_TOKEN}&client_id=${process.env.ZOHO_CLIENT_ID}&client_secret=${process.env.ZOHO_CLIENT_SECRET}&grant_type=refresh_token`,
    { method: 'POST' }
  )
  const data = await res.json()
  if (!data.access_token) throw new Error(`Zoho token: ${JSON.stringify(data)}`)
  return data.access_token
}

async function getAllZohoAccounts() {
  let token = await getZohoToken()
  const all = []
  let page = 1
  while (true) {
    const res = await fetch(
      `https://www.zohoapis.in/crm/v2/Accounts?fields=Account_Name&per_page=200&page=${page}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    )
    if (res.status === 204) break
    const data = await res.json()
    if (!data.data || data.data.length === 0) break
    all.push(...data.data.map(a => a.Account_Name).filter(Boolean))
    if (!data.info?.more_records) break
    page++
  }
  return all
}

async function getContactEmailsForAccount(zohoToken, accountName) {
  const STOP = new Set(['systems','technologies','solutions','software','finance',
    'group','india','pvt','ltd','inc','llc','the','and','of','for'])
  const cleaned    = accountName.replace(/\s*\(.*?\)\s*/g, '').trim()
  const words      = cleaned.split(/\s+/)
  // Use longest non-stop word (min 5 chars) to avoid generic "Info", "Apex" etc bleeding into wrong companies
  const candidates = words.filter(w => w.length >= 5 && !STOP.has(w.toLowerCase()))
  const searchWord = candidates.length > 0
    ? candidates.reduce((a, b) => a.length >= b.length ? a : b)
    : words[0]

  const url = `https://www.zohoapis.in/crm/v2/Contacts/search?word=${encodeURIComponent(searchWord)}&fields=Email,Full_Name&per_page=50`
  const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${zohoToken}` } })
  if (res.status === 204) return []
  if (!res.ok) return []
  const data = await res.json()
  if (!data.data) return []
  return data.data.filter(c => c.Email).map(c => ({ name: c.Full_Name || '', email: c.Email }))
}

// ── Gmail ─────────────────────────────────────────────────────────────────────

async function searchGmailForAccount(contacts, accountName) {
  const cleanName    = accountName.replace(/\s*\(.*?\)\s*/g, '').trim()
  const subjectClause = `subject:"The Test Tribe <> ${cleanName}"`

  const exclusions = `-category:promotions -category:social -category:forums -category:updates -from:finercircle -from:thriveedschool`

  let q
  if (contacts.length === 0) {
    q = `${subjectClause} newer_than:730d ${exclusions}`
  } else {
    const emailParts = contacts.map(c => `{from:${c.email} to:${c.email}}`).join(' OR ')
    q = `(${emailParts} OR ${subjectClause}) newer_than:730d ${exclusions}`
  }

  const listRes = await gmail.users.threads.list({ userId: 'me', q, maxResults: 20 })
  const items   = listRes.data.threads || []
  if (items.length === 0) return []

  const threads = []
  for (const t of items.slice(0, 15)) {
    try {
      const tr   = await gmail.users.threads.get({ userId: 'me', id: t.id, format: 'metadata', metadataHeaders: ['Subject', 'Date'] })
      const msg  = tr.data.messages?.[0]
      if (!msg) continue
      const hdrs    = msg.payload?.headers || []
      const subject = hdrs.find(h => h.name === 'Subject')?.value || '(no subject)'
      const dateRaw = hdrs.find(h => h.name === 'Date')?.value   || ''
      const snippet = (msg.snippet || '').slice(0, 250)
      const d       = new Date(dateRaw)
      const dateStr = isNaN(d.getTime()) ? dateRaw.slice(0, 10) : d.toISOString().slice(0, 10)
      threads.push({ date: dateStr, subject, snippet })
    } catch (_) {}
  }
  return threads
}

// ── Vercel endpoints ──────────────────────────────────────────────────────────

function authHeader() {
  return `Basic ${Buffer.from(`anurag:${DASHBOARD_PASSWORD}`).toString('base64')}`
}

async function postSyncEmail(account, threads) {
  const res = await fetch(`${VERCEL_URL}/api/account-intel/sync-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify({ account, threads }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return res.json()
}

// ── IST timestamp ─────────────────────────────────────────────────────────────

function istNow() {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  return `${ist.toISOString().slice(0, 10)} ${ist.toISOString().slice(11, 16)}`
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Read existing Account Intelligence accounts
  console.log('Reading Account Intelligence sheet...')
  const sheetRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Account Intelligence!A2:A',
  })
  const existingNames = (sheetRes.data.values || []).map(r => r[0]).filter(Boolean)
  console.log(`  ${existingNames.length} accounts already in sheet`)

  // 2. Get all Zoho accounts
  console.log('Fetching all Zoho accounts...')
  const zohoRaw = await getAllZohoAccounts()
  console.log(`  ${zohoRaw.length} total Zoho account records`)

  // 3. Deduplicate Zoho list (keep first occurrence of each normalised name)
  const seen   = new Set()
  const zohoUnique = []
  for (const name of zohoRaw) {
    if (isJunk(name)) continue
    const n = norm(name)
    if (!seen.has(n)) {
      seen.add(n)
      zohoUnique.push(name)
    }
  }
  console.log(`  ${zohoUnique.length} unique non-junk Zoho accounts`)

  // 4. Find accounts NOT yet in the sheet
  const toAdd = zohoUnique.filter(zohoName =>
    !existingNames.some(existing => isSameAccount(zohoName, existing))
  )
  console.log(`  ${toAdd.length} new accounts to add to sheet\n`)

  if (toAdd.length === 0) {
    console.log('Nothing to add. All Zoho accounts already in sheet.')
    return
  }

  // 5. Append new rows to Account Intelligence sheet (all Cold, intel empty)
  console.log(`Appending ${toAdd.length} new rows...`)
  const newRows = toAdd.map(name => [
    name, istNow(), '0', '', 'Cold', '', '', '', '', '', '',
  ])
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Account Intelligence!A:K',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: newRows },
  })
  console.log(`  ✅ Appended ${toAdd.length} rows\n`)

  // 6. Gmail sync for all new accounts
  console.log('Getting Zoho token for contact lookup...')
  const zohoToken = await getZohoToken()

  let synced = 0, noThreads = 0, errors = 0

  for (const account of toAdd) {
    process.stdout.write(`[${account}] `)

    const contacts = await getContactEmailsForAccount(zohoToken, account)
    process.stdout.write(contacts.length > 0 ? `${contacts.length} contact(s) → ` : `no contacts → `)

    let threads
    try {
      threads = await searchGmailForAccount(contacts, account)
    } catch (e) {
      if (e.message.includes('insufficientPermissions')) {
        console.error('\n❌ Gmail scope missing. Regenerate token with gmail.readonly scope.')
        process.exit(1)
      }
      console.log(`Gmail error: ${e.message}`)
      errors++
      await new Promise(r => setTimeout(r, 800))
      continue
    }

    if (threads.length === 0) {
      console.log('0 threads → skip')
      noThreads++
      await new Promise(r => setTimeout(r, 400))
      continue
    }

    try {
      await postSyncEmail(account, threads)
      console.log(`${threads.length} thread(s) → ✅`)
      synced++
    } catch (e) {
      console.log(`${threads.length} thread(s) → ❌ ${e.message}`)
      errors++
    }

    await new Promise(r => setTimeout(r, 800))
  }

  console.log('\n─────────────────────────────────────────')
  console.log(`New accounts added:    ${toAdd.length}`)
  console.log(`Gmail synced:          ${synced}`)
  console.log(`No threads found:      ${noThreads}`)
  console.log(`Errors:                ${errors}`)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
