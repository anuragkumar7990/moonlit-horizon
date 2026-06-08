import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!

function getSheets() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return google.sheets({ version: 'v4', auth: oauth2 })
}

const DELETED_ACCOUNTS = new Set([
  // no-deal accounts
  'avp','arbix ai solutions','birchstreet','bounteous x accolite','cgi',
  'essilor luxotica','evolent','getwell (sai group)','info edge',
  'jet2 travel technologies pvt ltd','key value systems','miraj','nielsen',
  'nitor infotech','octanner','pmc','rx logix','recur club','sudent',
  'synechron','tcs','wybor','zenq','zentity','meril.jacob@ltimindtree.com',
  // duplicate extras (the copies we deleted, keeping the primary)
  'aaseya','algoleap technologies','amadeus','betterworks','dark matter technology',
  'horizontal','lseg','lumoslabs','recvue','wabtec','workon grid','workongrid',
])

function normalize(name: string) {
  return name.trim().toLowerCase()
}

async function deleteRowsFromSheet(sheetName: string, accountCol: number): Promise<{ sheet: string; deleted: string[] }> {
  const sheets = getSheets()

  const colLetter = String.fromCharCode(65 + accountCol)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:${colLetter}`,
  })

  const rows = res.data.values ?? []
  // Collect 1-based row indices to delete (skip header row 1)
  const toDelete: number[] = []
  for (let i = 1; i < rows.length; i++) {
    const val = (rows[i][accountCol] ?? '').toString()
    if (DELETED_ACCOUNTS.has(normalize(val))) {
      toDelete.push(i + 1) // 1-based sheet row
    }
  }

  if (toDelete.length === 0) return { sheet: sheetName, deleted: [] }

  // Get the sheet ID
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const sheetMeta = meta.data.sheets?.find(s => s.properties?.title === sheetName)
  const sheetId = sheetMeta?.properties?.sheetId ?? 0

  // Delete rows in reverse order so indices don't shift
  const requests = toDelete.reverse().map(rowNum => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: 'ROWS',
        startIndex: rowNum - 1,
        endIndex: rowNum,
      },
    },
  }))

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  })

  const deletedNames = toDelete.map(i => (rows[i]?.[accountCol] ?? '').toString())
  return { sheet: sheetName, deleted: deletedNames }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const pwd = Buffer.from(auth.replace('Basic ', ''), 'base64').toString().split(':')[1]
  if (pwd !== (process.env.DASHBOARD_PASSWORD ?? 'thetesttribe')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Account Intelligence: account name is col A (index 0)
    // Contact Intelligence: company name is col H (index 7) per CI_COMP_COL in sheets.ts
    const [ai, ci] = await Promise.all([
      deleteRowsFromSheet('Account Intelligence', 0),
      deleteRowsFromSheet('Contact Intelligence', 7),
    ])

    return NextResponse.json({ ok: true, ai, ci })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
