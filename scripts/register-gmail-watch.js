/**
 * Register Gmail push notifications via the Watch API.
 *
 * Run once to start watching, then the weekly Vercel cron renews it automatically.
 * Watch expires after 7 days — the /api/intel-triggers/gmail/renew endpoint handles renewal.
 *
 * Prerequisites:
 *   1. GMAIL_WATCH_TOPIC set in .env.local  (format: projects/PROJECT_ID/topics/TOPIC_NAME)
 *   2. gmail-api-push@system.gserviceaccount.com has Pub/Sub Publisher role on that topic
 *   3. GOOGLE_REFRESH_TOKEN includes https://www.googleapis.com/auth/gmail.readonly scope
 *
 * Usage:
 *   node scripts/register-gmail-watch.js
 */

const fs   = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  })
}

const { google } = require('googleapis')

const TOPIC = process.env.GMAIL_WATCH_TOPIC
if (!TOPIC) {
  console.error('❌ GMAIL_WATCH_TOPIC not set in .env.local')
  console.error('   Format: projects/YOUR_PROJECT_ID/topics/moonlit-gmail-notifications')
  process.exit(1)
}

const oauth2 = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
)
oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })

const gmail = google.gmail({ version: 'v1', auth: oauth2 })

async function main() {
  console.log('Registering Gmail watch...')
  console.log(`Topic: ${TOPIC}`)

  let res
  try {
    res = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: TOPIC,
        labelIds: ['INBOX'],
        labelFilterBehavior: 'INCLUDE',
      },
    })
  } catch (e) {
    if (e.message?.includes('insufficientPermissions') || e.message?.includes('Request had insufficient')) {
      console.error('\n❌ Gmail scope missing from your refresh token.')
      console.error('   Regenerate at https://developers.google.com/oauthplayground')
      console.error('   Required scopes:')
      console.error('     https://www.googleapis.com/auth/gmail.readonly')
      console.error('     https://www.googleapis.com/auth/spreadsheets')
      console.error('     https://www.googleapis.com/auth/calendar')
    } else {
      console.error('❌ Watch registration failed:', e.message)
    }
    process.exit(1)
  }

  const { historyId, expiration } = res.data
  const expiresAt = new Date(Number(expiration)).toISOString()

  console.log('\n✅ Gmail watch registered!')
  console.log(`   historyId : ${historyId}`)
  console.log(`   expires   : ${expiresAt}`)
  console.log('\nNext steps:')
  console.log('  1. Add GMAIL_WATCH_TOPIC to Vercel environment variables')
  console.log('  2. The Vercel cron at /api/intel-triggers/gmail/renew runs weekly to keep the watch alive')
  console.log('\nInitial historyId to save in Sheets Config tab:')
  console.log(`  Row 1, Col A: gmail_history_id`)
  console.log(`  Row 1, Col B: ${historyId}`)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
