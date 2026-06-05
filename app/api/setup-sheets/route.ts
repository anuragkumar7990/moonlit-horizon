import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!

function getAuth() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return oauth2
}

const NEW_TABS: { title: string; headers: string[] }[] = [
  {
    title: 'Calling',
    headers: [
      'Date Moved', 'Email', 'First Name', 'Last Name', 'Company',
      'Designation', 'City', 'Phone', 'Lvl 1 Source', 'Lvl 2 Source',
      'Priority', 'Original Upload Date',
    ],
  },
  {
    title: 'Calls',
    headers: [
      'Date', 'Time', 'Account', 'Contact Name', 'Contact Phone',
      'SDR', 'Duration (min)', 'Outcome', 'Notes', 'Zoho Call ID',
      'Follow-up Date', 'Recording Drive Link', 'Transcript Summary', 'Auto Tags',
    ],
  },
  {
    title: 'Targets',
    headers: ['Month', 'Metric Name', 'Target Value', 'Actual Value'],
  },
  {
    title: 'Tasks',
    headers: ['Date', 'Task', 'Type', 'Assigned To', 'Linked Deal', 'Status', 'Completed At'],
  },
  {
    title: 'Payments',
    headers: ['Date', 'Account', 'Deal', 'Amount (₹)', 'Invoice Date', 'Due Date', 'Status', 'Notes'],
  },
]

// Notes tab needs an "Assigned To" column inserted before "Created At"
// Existing Notes layout: A=Meeting ID, B=Account Name, C=Summary, D=Actionables, E=Created At
// Target layout:         A=Meeting ID, B=Account Name, C=Summary, D=Actionables, E=Assigned To, F=Created At
// This endpoint only CHECKS — manual insertion of the column is required to avoid data loss.

export async function POST() {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
    const existingTabs = new Set(meta.data.sheets?.map(s => s.properties?.title ?? '') ?? [])

    const created: string[] = []
    const skipped: string[] = []
    const warnings: string[] = []

    // Check Notes tab has Assigned To column
    if (existingTabs.has('Notes')) {
      const headerRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Notes!A1:G1',
      })
      const noteHeaders = (headerRes.data.values?.[0] ?? []) as string[]
      if (!noteHeaders.includes('Assigned To')) {
        warnings.push(
          'Notes tab is missing the "Assigned To" column. ' +
          'Manually insert it as column E (shifting "Created At" to column F) before Phase 2 agents go live.'
        )
      }
    }

    for (const tab of NEW_TABS) {
      if (existingTabs.has(tab.title)) {
        skipped.push(tab.title)
        continue
      }

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: tab.title } } }] },
      })
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab.title}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [tab.headers] },
      })
      created.push(tab.title)
    }

    return NextResponse.json({ ok: true, created, skipped, warnings })
  } catch (err) {
    console.error('[/api/setup-sheets]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
