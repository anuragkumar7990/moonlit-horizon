/**
 * Reads Meetings sheet, finds HIST- rows, searches Zoho Deals by account name,
 * writes Deal ID back to col H.
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

async function getZohoToken() {
  const res = await fetch(
    `https://accounts.zoho.in/oauth/v2/token?refresh_token=${process.env.ZOHO_REFRESH_TOKEN}&client_id=${process.env.ZOHO_CLIENT_ID}&client_secret=${process.env.ZOHO_CLIENT_SECRET}&grant_type=refresh_token`,
    { method: 'POST' }
  )
  const data = await res.json()
  if (!data.access_token) throw new Error(`Zoho token error: ${JSON.stringify(data)}`)
  return data.access_token
}

async function searchDealByAccount(token, accountName) {
  // Search by account name — try exact then partial
  const encoded = encodeURIComponent(accountName)
  const url = `https://www.zohoapis.in/crm/v2/Deals/search?criteria=Account_Name.name:equals:${encoded}`
  const res  = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } })
  if (res.status === 204) return null
  const data = await res.json()
  return data.data?.[0] ?? null
}

async function main() {
  console.log('Reading Meetings sheet...')
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Meetings!A:J',
  })
  const rows = res.data.values || []
  console.log(`Total rows (incl header): ${rows.length}`)

  // Find HIST- rows with no dealId (col H = index 7)
  const histRows = rows
    .map((r, i) => ({ row: r, idx: i }))
    .filter(({ row }) => (row[0] || '').startsWith('HIST-') && !(row[7] || '').trim())

  console.log(`HIST- rows needing Deal ID: ${histRows.length}`)

  const token = await getZohoToken()
  console.log('Zoho token OK\n')

  // Build unique account → deal ID map (cache to avoid duplicate lookups)
  const dealCache = {}
  const updates   = []
  let matched = 0, unmatched = 0

  for (const { row, idx } of histRows) {
    const accountName = (row[1] || '').trim()
    if (!accountName) continue

    process.stdout.write(`Row ${idx+1} | ${accountName.padEnd(35)}`)

    if (!(accountName in dealCache)) {
      try {
        const deal = await searchDealByAccount(token, accountName)
        dealCache[accountName] = deal?.id ?? ''
        await new Promise(r => setTimeout(r, 150)) // stay within rate limit
      } catch (e) {
        dealCache[accountName] = ''
      }
    }

    const dealId = dealCache[accountName]
    if (dealId) {
      matched++
      console.log(`✅ ${dealId}`)
      // sheetRow = idx + 1 (1-indexed), col H = column 8
      updates.push({
        range: `Meetings!H${idx + 1}`,
        values: [[dealId]],
      })
    } else {
      unmatched++
      console.log('❌ no deal found')
    }
  }

  if (updates.length > 0) {
    console.log(`\nWriting ${updates.length} Deal IDs to sheet...`)
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates,
      },
    })
  }

  console.log(`\n── RESULTS ────────────────────────────────`)
  console.log(`✅ Matched: ${matched}`)
  console.log(`❌ No deal: ${unmatched}`)
}

main().catch(err => { console.error(err); process.exit(1) })
