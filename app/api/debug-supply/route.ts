import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

const TRAINER_OUTREACH_SHEET_ID = '1Xol3kb_5GDxS-Su-fAs1tIvTSLfGahNXWHv0MKUOY9I'
const TRAINER_SUPPLY_SHEET_ID   = '1R8FqcifveekYZsaS3taHARaQAo3CjZ0FqdHnNOcZg2U'

function getSheets() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return google.sheets({ version: 'v4', auth: oauth2 })
}

async function readFirst20(spreadsheetId: string, range: string) {
  try {
    const sheets = getSheets()
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })
    const rows = (res.data.values ?? []).slice(0, 20)
    return { ok: true, rows, totalRows: res.data.values?.length ?? 0 }
  } catch (err) {
    return { ok: false, error: String(err), rows: [], totalRows: 0 }
  }
}

export async function GET() {
  const [sheetA, sheetB] = await Promise.all([
    readFirst20(TRAINER_OUTREACH_SHEET_ID, 'A:L'),
    readFirst20(TRAINER_SUPPLY_SHEET_ID, 'A:L'),
  ])
  return NextResponse.json({ sheetA, sheetB })
}
