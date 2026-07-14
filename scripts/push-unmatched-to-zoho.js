/**
 * Pushes 125 unmatched prospects from CRM/unmatched-prospects.csv to Zoho Leads
 * in batches of 100. Sets Lvl_1_Source, Lvl_2_Source, Lead_Status from call outcome.
 */

const fs   = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env.local')
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
})

const CSV_PATH = path.join(__dirname, '..', '..', 'CRM', 'unmatched-prospects.csv')

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

// Map last call outcome → Zoho Lead_Status
function mapLeadStatus(outcome) {
  switch (outcome) {
    case 'Meeting Booked':       return 'Meeting Scheduled'
    case 'Send More Info':       return 'Contacted'
    case 'Callback Later':       return 'Attempted to Contact'
    case 'Invalid Number':       return 'Not Contacted'
    case 'Switched Off':         return 'Not Contacted'
    case 'Incoming Unavailable': return 'Not Contacted'
    default:                     return 'Not Contacted'
  }
}

async function getZohoToken() {
  const res = await fetch(
    `https://accounts.zoho.in/oauth/v2/token?refresh_token=${process.env.ZOHO_REFRESH_TOKEN}&client_id=${process.env.ZOHO_CLIENT_ID}&client_secret=${process.env.ZOHO_CLIENT_SECRET}&grant_type=refresh_token`,
    { method: 'POST' }
  )
  const data = await res.json()
  if (!data.access_token) throw new Error(`Zoho token error: ${JSON.stringify(data)}`)
  return data.access_token
}

async function createLeads(token, leads) {
  const res = await fetch('https://www.zohoapis.in/crm/v2/Leads', {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: leads }),
  })
  const data = await res.json()
  return data
}

async function main() {
  const raw   = fs.readFileSync(CSV_PATH, 'utf8')
  const lines = raw.split('\n').filter(l => l.trim())
  const rows  = lines.slice(1).map(parseRow)

  console.log(`📂 Loaded ${rows.length} prospects from unmatched-prospects.csv`)

  const token = await getZohoToken()
  console.log('Zoho token OK\n')

  // Build Zoho Lead objects
  // CSV cols: Name(0) Email(1) Phone(2) Title(3) Company(4) L1(5) L2(6) SDR(7)
  //           FirstContactDate(8) TotalCalls(9) ConnRate%(10) MeetingBooked(11)
  //           LastCallDate(12) LastCallOutcome(13) Notes(14)
  //
  // Lead_Source is a strict Zoho picklist and does NOT include a plain "Internal" value —
  // must keep this mapping in sync with LEAD_SOURCE_MAP in lib/zoho.ts (createLeads()).
  const LEAD_SOURCE_MAP = {
    'Webinar': 'Webinar Attendee',
    'Events': 'Corporate Training Event Attendee',
    'Email': 'Cold Email',
    'Cold Outreach': 'Cold Call',
    'Referrals': 'External Referral',
    'Internal Community Data': 'Internal Community Data',
  }
  const leads = rows.map(r => {
    const fullName = (r[0] || '').trim()
    const nameParts = fullName.split(' ')
    const firstName = nameParts[0] || fullName
    const lastName  = nameParts.slice(1).join(' ') || '.'

    return {
      First_Name:      firstName,
      Last_Name:       lastName,
      Email:           r[1] || undefined,
      Phone:           r[2] || undefined,
      Title:           r[3] || undefined,
      Company:         r[4] || 'Unknown',
      Lvl_1_Source:    r[5] || undefined,
      Lvl_2_Source:    r[6] || undefined,
      Lead_Status:     mapLeadStatus(r[13]),
      Description:     r[14] ? `Last call outcome: ${r[13]}. Notes: ${r[14]}` : `Last call outcome: ${r[13]}`,
      Lead_Source:     LEAD_SOURCE_MAP[r[5]] || 'Internal Community Data',
    }
  }).filter(l => l.Last_Name) // must have at least a name

  console.log(`Pushing ${leads.length} leads to Zoho in batches of 100...\n`)

  const BATCH = 100
  let created = 0, failed = 0
  const failures = []

  for (let i = 0; i < leads.length; i += BATCH) {
    const batch = leads.slice(i, i + BATCH)
    const batchNum = Math.floor(i / BATCH) + 1
    process.stdout.write(`Batch ${batchNum}: pushing ${batch.length} leads... `)

    try {
      const result = await createLeads(token, batch)
      const batchCreated = result.data?.filter(r => r.status === 'success').length || 0
      const batchFailed  = result.data?.filter(r => r.status !== 'success') || []

      created += batchCreated
      failed  += batchFailed.length

      batchFailed.forEach((f, idx) => {
        failures.push({ lead: batch[idx]?.First_Name + ' ' + batch[idx]?.Last_Name, error: f.message || f.code })
      })

      console.log(`✅ ${batchCreated} created, ${batchFailed.length} failed`)
    } catch (e) {
      console.log(`❌ Error: ${e.message}`)
      failed += batch.length
    }

    // Small pause between batches
    if (i + BATCH < leads.length) await new Promise(r => setTimeout(r, 2000))
  }

  console.log(`\n── RESULTS ────────────────────────────────`)
  console.log(`✅ Created: ${created}`)
  console.log(`❌ Failed:  ${failed}`)

  if (failures.length > 0) {
    console.log('\nFailed entries:')
    failures.forEach(f => console.log(`  ${f.lead}: ${f.error}`))
  }

  console.log('\nDone. New Leads visible in Zoho CRM → Leads module.')
}

main().catch(err => { console.error(err); process.exit(1) })
