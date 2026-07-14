import { google } from 'googleapis'

// Adapted from tribeqonf-2026/server/src/services/email.js — sends via the Gmail API over
// HTTPS rather than SMTP. Railway (the Phase 2 hosting target for this app) blocks outbound
// SMTP-port traffic platform-wide, so Gmail API is the only channel that keeps working if/when
// this code runs there; it's also proven-working against the same thetesttribe.com Workspace.
//
// Reuses the SAME Google OAuth2 credentials already used for Sheets/Calendar
// (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN, see lib/sheets.ts's getAuth())
// rather than a separate credential set. IMPORTANT: this only works if that refresh token's
// original OAuth consent included the gmail.send scope — Gmail Push (Watch API) alone doesn't
// require send access. If sends fail with an insufficient-scope/403 error, the refresh token
// needs re-consenting with gmail.send added (see SETUP.md Step 2) — this cannot be verified
// without a live send attempt.
const FROM = process.env.SYNC_ALERT_FROM_EMAIL || 'Moonlit Horizon <anurag@thetesttribe.com>'

function getOAuthClient() {
  const client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return client
}

function base64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function buildRawMessage(to: string, subject: string, text: string): string {
  const headers = [
    `From: ${FROM}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
  ]
  return base64url([...headers, '', text].join('\r\n'))
}

export async function sendAlertEmail(to: string, subject: string, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const auth = getOAuthClient()
    const gmail = google.gmail({ version: 'v1', auth })
    const raw = buildRawMessage(to, subject, text)
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
    return { ok: true }
  } catch (err) {
    console.error('[email] sendAlertEmail failed:', err)
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
