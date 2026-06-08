import { NextRequest, NextResponse } from 'next/server'
import { getSheets, SPREADSHEET_ID } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

// One-time seed: writes 8 historical invoices to the Payments sheet.
// Secured by ?key=<DASHBOARD_PASSWORD>. Safe to call multiple times —
// check for existing rows by invoice number in notes to avoid duplicates.

const INVOICE_ROWS: [string, string, string, number, string, string, string, string, string][] = [
  // [date, account, deal, amount, invoiceDate, dueDate, status, notes, attachmentUrl]
  ['2026-02-10', 'RxLogix Corporation India Private Limited', 'RxLogix AI/ML Training – AI Foundations (advance)', 441000, '2026-02-10', '2026-02-10', 'Invoiced', 'Invoice TTT-227', ''],
  ['2026-03-16', 'RxLogix Corporation India Private Limited', 'RxLogix AI/ML Training – AI Foundations (balance)', 189000, '2026-03-16', '2026-03-20', 'Invoiced', 'Invoice TTT-233', ''],
  ['2026-03-18', 'RxLogix Corporation India Private Limited', 'RxLogix BQA Upskilling (70%)', 338800, '2026-03-18', '2026-03-25', 'Invoiced', 'Invoice TTT-234', ''],
  ['2026-04-20', 'RxLogix Corporation India Private Limited', 'RxLogix BQA Upskilling (30% balance)', 145200, '2026-04-20', '2026-04-27', 'Invoiced', 'Invoice TTT-239', ''],
  ['2026-05-18', 'Tungsten Development Private Limited', 'Tungsten QA Upskilling – 20h', 285986, '2026-05-18', '2026-05-25', 'Invoiced', 'Invoice TTT-246', ''],
  ['2026-05-06', 'Wartsila India Private Limited', 'Wartsila Agentic AI Training (70%)', 89250, '2026-05-06', '2026-05-12', 'Invoiced', 'Invoice TTT-248', ''],
  ['2026-02-18', 'Betterworks Inc', 'Betterworks AI Agents in QA', 2376, '2026-02-18', '2026-02-20', 'Invoiced', 'Invoice BW-00001 (USD – $2,494.80 incl. cross-border charge)', ''],
  ['2026-06-09', 'ExaThought', 'ExaThought Agentic AI Training – 8h', 52000, '', '', 'Invoiced', 'Proforma/Quote (no formal invoice number)', ''],
]

export async function GET(req: NextRequest) {
  const dashboardPwd = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'
  const key = req.nextUrl.searchParams.get('key') ?? ''
  if (key !== dashboardPwd) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sheets = getSheets()

  // Ensure Payments tab exists
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const tabExists = meta.data.sheets?.some(s => s.properties?.title === 'Payments')
  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Payments' } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Payments!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['Date', 'Account', 'Deal', 'Amount', 'Invoice Date', 'Due Date', 'Status', 'Notes', 'Attachment URL']] },
    })
  }

  // Read existing notes column to detect duplicates by invoice number
  let existingNotes: string[] = []
  try {
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Payments!H:H',
    })
    existingNotes = (existing.data.values ?? []).flat().map(v => String(v))
  } catch { /* ignore */ }

  const written: string[] = []
  const skipped: string[] = []

  for (const row of INVOICE_ROWS) {
    const notes = row[7]
    const alreadyExists = existingNotes.some(n => n === notes)
    if (alreadyExists) {
      skipped.push(notes)
      continue
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Payments!A:I',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    })
    existingNotes.push(notes)
    written.push(notes)
  }

  return NextResponse.json({ written, skipped, total: INVOICE_ROWS.length })
}
