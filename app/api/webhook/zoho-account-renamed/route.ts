import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!
const WEBHOOK_SECRET = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'
const ACCOUNT_COL = 2  // Column C (0-indexed)
const ZOHO_CALL_ID_COL = 9  // Column J (0-indexed)

function getSheets() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return google.sheets({ version: 'v4', auth: oauth2 })
}

// Rename all Calls rows where column C matches oldName (case-insensitive)
async function renameByOldName(oldName: string, newName: string): Promise<number> {
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Calls!A:N',
  })
  const rows = res.data.values ?? []
  const norm = (s: string) => s.toLowerCase().trim()
  const updates: { range: string; values: string[][] }[] = []

  rows.forEach((row, i) => {
    if (i === 0) return
    const cell = String(row[ACCOUNT_COL] ?? '')
    if (norm(cell) === norm(oldName)) {
      updates.push({ range: `Calls!C${i + 1}`, values: [[newName]] })
    }
  })

  if (updates.length === 0) return 0

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: updates },
  })
  return updates.length
}

// Rename all Calls rows where column J (Zoho Call ID) matches any of the provided call IDs
async function renameByZohoCallIds(callIds: string[], newName: string): Promise<number> {
  if (callIds.length === 0) return 0
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Calls!A:N',
  })
  const rows = res.data.values ?? []
  const idSet = new Set(callIds.map(id => id.trim()))
  const updates: { range: string; values: string[][] }[] = []

  rows.forEach((row, i) => {
    if (i === 0) return
    const zohoCallId = String(row[ZOHO_CALL_ID_COL] ?? '').trim()
    if (zohoCallId && idSet.has(zohoCallId)) {
      updates.push({ range: `Calls!C${i + 1}`, values: [[newName]] })
    }
  })

  if (updates.length === 0) return 0

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: updates },
  })
  return updates.length
}

// Fetch Zoho call IDs linked to an account (via What_Id)
async function getZohoCallIdsForAccount(accountId: string): Promise<string[]> {
  const BASE = 'https://www.zohoapis.in/crm/v3'

  // Refresh Zoho token
  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
    client_id:     process.env.ZOHO_CLIENT_ID!,
    client_secret: process.env.ZOHO_CLIENT_SECRET!,
    grant_type:    'refresh_token',
  })
  const tokenRes = await fetch(`https://accounts.zoho.in/oauth/v2/token?${params}`, { method: 'POST' })
  const tokenData = await tokenRes.json() as Record<string, unknown>
  if (!tokenData.access_token) return []

  const token = String(tokenData.access_token)

  // Fetch calls where What_Id = accountId
  const callsRes = await fetch(
    `${BASE}/Calls?criteria=(What_Id:equals:${accountId})&fields=id&per_page=200`,
    { headers: { Authorization: `Zoho-oauthtoken ${token}` }, cache: 'no-store' },
  )
  const callsData = await callsRes.json() as { data?: Record<string, unknown>[] }
  return (callsData.data ?? []).map(c => String(c.id ?? '')).filter(Boolean)
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try {
    const ct = req.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      body = await req.json() as Record<string, unknown>
    } else if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
      const form = await req.formData()
      form.forEach((v, k) => { body[k] = v })
    } else {
      const text = await req.text()
      if (text) body = JSON.parse(text) as Record<string, unknown>
    }
  } catch { /* ignore parse errors */ }

  // Support both URL params and body fields
  const oldName  = String(body.oldName  ?? req.nextUrl.searchParams.get('oldName')  ?? '').trim()
  const newName  = String(body.newName  ?? req.nextUrl.searchParams.get('newName')  ?? '').trim()
  const accountId = String(body.accountId ?? req.nextUrl.searchParams.get('accountId') ?? '').trim()

  if (!newName) {
    return NextResponse.json({ error: 'newName is required' }, { status: 400 })
  }

  // Mode 1: old name + new name → direct find-and-replace in Calls tab
  if (oldName && oldName !== newName) {
    const updated = await renameByOldName(oldName, newName)
    console.log(`[webhook/zoho-account-renamed] Renamed "${oldName}" → "${newName}": ${updated} rows`)
    return NextResponse.json({ ok: true, mode: 'by-name', updated, oldName, newName })
  }

  // Mode 2: account ID + new name → find Zoho calls for this account, update by Zoho Call ID
  if (accountId) {
    const callIds = await getZohoCallIdsForAccount(accountId)
    console.log(`[webhook/zoho-account-renamed] accountId=${accountId} → ${callIds.length} Zoho calls`)
    const updated = await renameByZohoCallIds(callIds, newName)
    console.log(`[webhook/zoho-account-renamed] Updated ${updated} Calls rows to "${newName}"`)
    return NextResponse.json({ ok: true, mode: 'by-account-id', accountId, callIds: callIds.length, updated, newName })
  }

  return NextResponse.json({ error: 'Provide (oldName + newName) or (accountId + newName)' }, { status: 400 })
}
