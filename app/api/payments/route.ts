import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

function getSheets() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return google.sheets({ version: 'v4', auth: oauth2 })
}

export async function GET() {
  try {
    const sheets = getSheets()
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEETS_SPREADSHEET_ID!,
      range: 'Payments!A:I',
    })
    const rows = res.data.values ?? []

    const payments = rows.slice(1).map((r, i) => ({
      rowIndex:      i + 2, // 1-indexed sheet row (header = row 1, data starts at row 2)
      date:          r[0] ?? '',
      account:       r[1] ?? '',
      deal:          r[2] ?? '',
      amount:        parseInt(r[3] ?? '0', 10) || 0,
      invoiceDate:   r[4] ?? '',
      dueDate:       r[5] ?? '',
      status:        r[6] ?? 'Invoiced',
      notes:         r[7] ?? '',
      attachmentUrl: r[8] ?? '',
    })).filter(p => p.account)

    return NextResponse.json({ payments })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
