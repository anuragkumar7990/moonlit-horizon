import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!
const SECRET = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'
const ACCOUNT_COL_INDEX = 2 // Column C = Account in Calls tab

function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key:  process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}

export async function POST(req: NextRequest) {
  const pwd = req.headers.get('x-dashboard-password') ?? req.nextUrl.searchParams.get('password')
  if (pwd !== SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as { oldName?: string; newName?: string }
  const oldName = body.oldName?.trim()
  const newName = body.newName?.trim()

  if (!oldName || !newName) {
    return NextResponse.json({ error: 'oldName and newName are required' }, { status: 400 })
  }
  if (oldName === newName) {
    return NextResponse.json({ error: 'oldName and newName are the same' }, { status: 400 })
  }

  const sheets = getSheets()

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Calls!A:N',
  })

  const rows = res.data.values ?? []
  const norm = (s: string) => s.toLowerCase().trim()
  const updates: { range: string; values: string[][] }[] = []

  rows.forEach((row, i) => {
    if (i === 0) return // skip header
    const cell = String(row[ACCOUNT_COL_INDEX] ?? '')
    if (norm(cell) === norm(oldName)) {
      updates.push({ range: `Calls!C${i + 1}`, values: [[newName]] })
    }
  })

  if (updates.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, message: `No rows found with account name "${oldName}"` })
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: updates },
  })

  return NextResponse.json({ ok: true, updated: updates.length, oldName, newName })
}
