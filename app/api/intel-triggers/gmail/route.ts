import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { syncEmailIntel, type EmailThread } from '@/lib/intel'

export const dynamic = 'force-dynamic'

// ── Google auth ───────────────────────────────────────────────────────────────

function getGmailClient() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return google.gmail({ version: 'v1', auth: oauth2 })
}

function getSheetsClient() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return google.sheets({ version: 'v4', auth: oauth2 })
}

// ── historyId cursor (stored in Sheets "Config" tab, row 1) ──────────────────
// Config tab layout: col A = key, col B = value
// Row 1: gmail_history_id | <number>

async function getStoredHistoryId(): Promise<string | null> {
  try {
    const sheets = getSheetsClient()
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEETS_SPREADSHEET_ID!,
      range: 'Config!A:B',
    })
    const rows = res.data.values ?? []
    const row = rows.find(r => r[0] === 'gmail_history_id')
    return row?.[1] ?? null
  } catch {
    return null
  }
}

async function saveHistoryId(historyId: string) {
  const sheets = getSheetsClient()
  // Read current Config rows to find or append
  let rowIndex = -1
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEETS_SPREADSHEET_ID!,
      range: 'Config!A:B',
    })
    const rows = res.data.values ?? []
    rowIndex = rows.findIndex(r => r[0] === 'gmail_history_id')
  } catch { /* tab may not exist yet */ }

  if (rowIndex >= 0) {
    // Update existing row (1-indexed, +1 for sheet offset)
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SHEETS_SPREADSHEET_ID!,
      range: `Config!B${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[historyId]] },
    })
  } else {
    // Append new row
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SHEETS_SPREADSHEET_ID!,
      range: 'Config!A:B',
      valueInputOption: 'RAW',
      requestBody: { values: [['gmail_history_id', historyId]] },
    })
  }
}

// ── Account name extraction from subject ──────────────────────────────────────
// Subject pattern: "The Test Tribe <> AccountName" or "The Test Tribe <> AccountName (RIL)"

function extractAccountFromSubject(subject: string): string | null {
  const m = subject.match(/The Test Tribe\s*<>\s*(.+)/i)
  if (!m) return null
  // Strip trailing parentheticals like "(RIL)"
  return m[1].replace(/\s*\(.*?\)\s*$/, '').trim()
}

// ── Gmail thread fetcher (reuses logic from sync-gmail-intel.js) ──────────────

async function fetchThreadsForAccount(
  gmail: ReturnType<typeof getGmailClient>,
  accountName: string,
  contactEmails: string[]
): Promise<EmailThread[]> {
  const cleanName = accountName.replace(/\s*\(.*?\)\s*/g, '').trim()
  const subjectClause = `subject:"The Test Tribe <> ${cleanName}"`
  const exclusions = `-category:promotions -category:social -category:forums -category:updates -from:finercircle -from:thriveedschool`

  let q: string
  if (contactEmails.length === 0) {
    q = `${subjectClause} newer_than:730d ${exclusions}`
  } else {
    const emailParts = contactEmails.map(e => `{from:${e} to:${e}}`).join(' OR ')
    q = `(${emailParts} OR ${subjectClause}) newer_than:730d ${exclusions}`
  }

  const listRes = await gmail.users.threads.list({ userId: 'me', q, maxResults: 20 })
  const threadItems = listRes.data.threads ?? []

  const threads: EmailThread[] = []
  for (const t of threadItems.slice(0, 15)) {
    try {
      const threadRes = await gmail.users.threads.get({
        userId: 'me',
        id: t.id!,
        format: 'metadata',
        metadataHeaders: ['Subject', 'Date', 'From', 'To'],
      })
      const msg = threadRes.data.messages?.[0]
      if (!msg) continue
      const hdrs    = msg.payload?.headers ?? []
      const subject = hdrs.find(h => h.name === 'Subject')?.value ?? '(no subject)'
      const dateRaw = hdrs.find(h => h.name === 'Date')?.value   ?? ''
      const snippet = (msg.snippet ?? '').slice(0, 250)
      const d       = new Date(dateRaw)
      const dateStr = isNaN(d.getTime()) ? dateRaw.slice(0, 10) : d.toISOString().slice(0, 10)
      threads.push({ date: dateStr, subject, snippet })
    } catch { /* skip */ }
  }
  return threads
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Pub/Sub delivers: { message: { data: base64, messageId, publishTime }, subscription }
    const body = await req.json()
    const data = body?.message?.data
    if (!data) {
      // Pub/Sub sends an empty ping when the subscription is first confirmed — return 200
      return NextResponse.json({ ok: true, note: 'no data payload' })
    }

    // Decode the Pub/Sub notification
    let notification: { emailAddress?: string; historyId?: string | number }
    try {
      notification = JSON.parse(Buffer.from(data, 'base64').toString('utf8'))
    } catch {
      return NextResponse.json({ error: 'invalid base64 payload' }, { status: 400 })
    }

    const newHistoryId = String(notification.historyId ?? '')
    if (!newHistoryId) {
      return NextResponse.json({ ok: true, note: 'no historyId in notification' })
    }

    // Load the last cursor we stored
    const storedHistoryId = await getStoredHistoryId()
    if (!storedHistoryId) {
      // First notification — save the cursor and wait for the next one
      // (We have no baseline to diff from, so we can't know what changed)
      await saveHistoryId(newHistoryId)
      return NextResponse.json({ ok: true, note: 'first notification — cursor saved' })
    }

    // Fetch history delta since our last cursor
    const gmailClient = getGmailClient()
    const historyRes = await gmailClient.users.history.list({
      userId: 'me',
      startHistoryId: storedHistoryId,
      historyTypes: ['messageAdded'],
      labelId: 'INBOX',
    })

    // Save the new cursor immediately (even if processing fails below)
    await saveHistoryId(newHistoryId)

    const historyRecords = historyRes.data.history ?? []
    if (historyRecords.length === 0) {
      return NextResponse.json({ ok: true, note: 'no new messages in history delta' })
    }

    // Collect unique thread IDs from added messages
    const threadIds = new Set<string>()
    for (const record of historyRecords) {
      for (const added of record.messagesAdded ?? []) {
        if (added.message?.threadId) threadIds.add(added.message.threadId)
      }
    }

    // For each thread, extract account name from subject
    const accountsToSync = new Set<string>()
    for (const threadId of threadIds) {
      try {
        const threadRes = await gmailClient.users.threads.get({
          userId: 'me',
          id: threadId,
          format: 'metadata',
          metadataHeaders: ['Subject'],
        })
        const msg     = threadRes.data.messages?.[0]
        const subject = msg?.payload?.headers?.find(h => h.name === 'Subject')?.value ?? ''
        const account = extractAccountFromSubject(subject)
        if (account) accountsToSync.add(account)
      } catch { /* skip */ }
    }

    if (accountsToSync.size === 0) {
      return NextResponse.json({ ok: true, note: 'no TTT threads in this batch' })
    }

    // Sync email intel for each matched account
    const results: Record<string, string> = {}
    for (const account of accountsToSync) {
      try {
        const threads = await fetchThreadsForAccount(gmailClient, account, [])
        if (threads.length > 0) {
          await syncEmailIntel(account, threads)
          results[account] = 'synced'
        } else {
          results[account] = 'no threads found'
        }
      } catch (e) {
        console.error(`[gmail-trigger] failed for account "${account}":`, e)
        results[account] = `error: ${String(e)}`
      }
    }

    return NextResponse.json({ ok: true, accountsSynced: results })
  } catch (e) {
    console.error('[intel-triggers/gmail]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
