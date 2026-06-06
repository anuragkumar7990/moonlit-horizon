/**
 * Sync Gmail threads → Email Intelligence for all accounts in Account Intelligence sheet.
 *
 * Prerequisites: The Google refresh token in .env.local must include Gmail readonly scope.
 * If you get "insufficient permissions", regenerate the token at:
 *   https://developers.google.com/oauthplayground
 *   Add scope: https://www.googleapis.com/auth/gmail.readonly
 *   (keep existing Sheets + Calendar scopes too)
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

const SPREADSHEET_ID    = process.env.SHEETS_SPREADSHEET_ID
const VERCEL_URL        = 'https://moonlit-horizon.vercel.app'
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'thetesttribe'

const oauth2 = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
)
oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })

const sheets = google.sheets({ version: 'v4', auth: oauth2 })
const gmail  = google.gmail({ version: 'v1', auth: oauth2 })

// ── Zoho CRM ──────────────────────────────────────────────────────────────────

async function getZohoToken() {
  const res = await fetch(
    `https://accounts.zoho.in/oauth/v2/token?refresh_token=${process.env.ZOHO_REFRESH_TOKEN}&client_id=${process.env.ZOHO_CLIENT_ID}&client_secret=${process.env.ZOHO_CLIENT_SECRET}&grant_type=refresh_token`,
    { method: 'POST' }
  )
  const data = await res.json()
  if (!data.access_token) throw new Error(`Zoho token error: ${JSON.stringify(data)}`)
  return data.access_token
}

// Words too generic to use as a Zoho search term
const STOP_WORDS = new Set(['systems', 'technologies', 'solutions', 'software', 'finance',
  'group', 'india', 'pvt', 'ltd', 'inc', 'llc', 'the', 'and', 'of', 'for'])

function extractSearchWord(accountName) {
  // Strip parenthetical "(RIL)" etc, pick longest non-stop word (min 5 chars) to avoid
  // generic terms like "Info" or "Apex" matching unrelated companies in Zoho
  const cleaned = accountName.replace(/\s*\(.*?\)\s*/g, '').trim()
  const words = cleaned.split(/\s+/)
  const candidates = words.filter(w => w.length >= 5 && !STOP_WORDS.has(w.toLowerCase()))
  if (candidates.length > 0) return candidates.reduce((a, b) => a.length >= b.length ? a : b)
  // Fallback: first word of any length
  return words[0]
}

async function getContactEmailsForAccount(zohoToken, accountName) {
  const searchWord = extractSearchWord(accountName)
  const url = `https://www.zohoapis.in/crm/v2/Contacts/search?word=${encodeURIComponent(searchWord)}&fields=Email,Full_Name&per_page=50`
  const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${zohoToken}` } })
  if (res.status === 204) return []
  if (!res.ok) return []
  const data = await res.json()
  if (!data.data) return []
  // Trust Zoho's word search — it searches across all contact fields including account name
  return data.data
    .filter(c => c.Email)
    .map(c => ({ name: c.Full_Name || '', email: c.Email }))
}

// ── Gmail ─────────────────────────────────────────────────────────────────────

async function searchGmailForEmails(contacts, accountName) {
  // Subject pattern: "The Test Tribe <> <Account Name>" (strip parentheticals like "(RIL)")
  const cleanName = accountName.replace(/\s*\(.*?\)\s*/g, '').trim()
  const subjectClause = `subject:"The Test Tribe <> ${cleanName}"`

  // Exclude newsletters, promotions, course/event emails
  const exclusions = `-category:promotions -category:social -category:forums -category:updates -from:finercircle -from:thriveedschool`

  let q
  if (contacts.length === 0) {
    q = `${subjectClause} newer_than:730d ${exclusions}`
  } else {
    const emailParts = contacts.map(c => `{from:${c.email} to:${c.email}}`).join(' OR ')
    q = `(${emailParts} OR ${subjectClause}) newer_than:730d ${exclusions}`
  }

  const listRes = await gmail.users.threads.list({ userId: 'me', q, maxResults: 20 })
  const threadItems = listRes.data.threads || []
  if (threadItems.length === 0) return []

  const threads = []
  for (const t of threadItems.slice(0, 15)) {
    try {
      const threadRes = await gmail.users.threads.get({
        userId: 'me',
        id: t.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'Date', 'From', 'To'],
      })
      const msg = threadRes.data.messages?.[0]
      if (!msg) continue

      const hdrs    = msg.payload?.headers || []
      const subject = hdrs.find(h => h.name === 'Subject')?.value || '(no subject)'
      const dateRaw = hdrs.find(h => h.name === 'Date')?.value   || ''
      const snippet = (msg.snippet || '').slice(0, 250)

      const d       = new Date(dateRaw)
      const dateStr = isNaN(d.getTime()) ? dateRaw.slice(0, 10) : d.toISOString().slice(0, 10)

      threads.push({ date: dateStr, subject, snippet })
    } catch (_) {
      // skip individual thread errors
    }
  }

  return threads
}

// ── Vercel sync-email endpoint ────────────────────────────────────────────────

async function postSyncEmail(account, threads) {
  const auth = Buffer.from(`anurag:${DASHBOARD_PASSWORD}`).toString('base64')
  const res = await fetch(`${VERCEL_URL}/api/account-intel/sync-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({ account, threads }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Optional: pass a single account name as argument to sync just one account
  const targetAccount = process.argv[2]

  console.log('Reading Account Intelligence sheet...')
  const sheetRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Account Intelligence!A2:A',
  })
  let accountNames = (sheetRes.data.values || []).map(r => r[0]).filter(Boolean)

  if (targetAccount) {
    const norm = s => s.toLowerCase().trim()
    accountNames = accountNames.filter(a => norm(a) === norm(targetAccount))
    if (accountNames.length === 0) {
      console.error(`Account "${targetAccount}" not found in sheet.`)
      process.exit(1)
    }
  }

  console.log(`Syncing ${accountNames.length} account(s)...\n`)

  console.log('Getting Zoho access token...')
  const zohoToken = await getZohoToken()
  console.log('Zoho token OK\n')

  let synced = 0, skipped = 0, errors = 0

  for (const account of accountNames) {
    process.stdout.write(`[${account}] `)

    // 1. Get contact emails from Zoho (may be empty — subject search still runs)
    const contacts = await getContactEmailsForAccount(zohoToken, account)
    process.stdout.write(contacts.length > 0 ? `${contacts.length} contact(s) → ` : `no Zoho contacts → `)

    // 2. Search Gmail
    let threads
    try {
      threads = await searchGmailForEmails(contacts, account)
    } catch (e) {
      if (e.message.includes('insufficientPermissions') || e.message.includes('Request had insufficient')) {
        console.error('\n\n❌ Gmail scope missing from refresh token.')
        console.error('Regenerate at https://developers.google.com/oauthplayground')
        console.error('Add scope: https://www.googleapis.com/auth/gmail.readonly')
        process.exit(1)
      }
      console.log(`Gmail error: ${e.message}`)
      errors++
      continue
    }

    if (threads.length === 0) {
      console.log('0 Gmail threads → skip')
      skipped++
      continue
    }
    process.stdout.write(`${threads.length} thread(s) → `)

    // 3. POST to Vercel
    try {
      await postSyncEmail(account, threads)
      console.log('✅ synced')
      synced++
    } catch (e) {
      console.log(`❌ ${e.message}`)
      errors++
    }

    // Respect Gmail rate limits
    await new Promise(r => setTimeout(r, 800))
  }

  console.log(`\n─────────────────────────────`)
  console.log(`Done. Synced: ${synced} | Skipped (no data): ${skipped} | Errors: ${errors}`)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
