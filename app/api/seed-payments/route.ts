import { NextRequest, NextResponse } from 'next/server'
import { appendPaymentRowRaw, getPayments } from '@/lib/sheets'
import type { Payment } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

// One-time seed: writes 8 historical invoices to the Payments sheet.
// Secured by ?key=<DASHBOARD_PASSWORD>. Idempotent — skips rows already
// present by matching on the notes column (which contains the invoice number).

const INVOICE_ROWS: Array<Omit<Payment, 'attachmentUrl'> & { attachmentUrl: string }> = [
  { date: '2026-02-10', account: 'RxLogix Corporation India Private Limited', deal: 'RxLogix AI/ML Training – AI Foundations (advance)', amount: 441000, invoiceDate: '2026-02-10', dueDate: '2026-02-10', status: 'Invoiced', notes: 'Invoice TTT-227', attachmentUrl: '' },
  { date: '2026-03-16', account: 'RxLogix Corporation India Private Limited', deal: 'RxLogix AI/ML Training – AI Foundations (balance)', amount: 189000, invoiceDate: '2026-03-16', dueDate: '2026-03-20', status: 'Invoiced', notes: 'Invoice TTT-233', attachmentUrl: '' },
  { date: '2026-03-18', account: 'RxLogix Corporation India Private Limited', deal: 'RxLogix BQA Upskilling (70%)', amount: 338800, invoiceDate: '2026-03-18', dueDate: '2026-03-25', status: 'Invoiced', notes: 'Invoice TTT-234', attachmentUrl: '' },
  { date: '2026-04-20', account: 'RxLogix Corporation India Private Limited', deal: 'RxLogix BQA Upskilling (30% balance)', amount: 145200, invoiceDate: '2026-04-20', dueDate: '2026-04-27', status: 'Invoiced', notes: 'Invoice TTT-239', attachmentUrl: '' },
  { date: '2026-05-18', account: 'Tungsten Development Private Limited', deal: 'Tungsten QA Upskilling – 20h', amount: 285986, invoiceDate: '2026-05-18', dueDate: '2026-05-25', status: 'Invoiced', notes: 'Invoice TTT-246', attachmentUrl: '' },
  { date: '2026-05-06', account: 'Wartsila India Private Limited', deal: 'Wartsila Agentic AI Training (70%)', amount: 89250, invoiceDate: '2026-05-06', dueDate: '2026-05-12', status: 'Invoiced', notes: 'Invoice TTT-248', attachmentUrl: '' },
  { date: '2026-02-18', account: 'Betterworks Inc', deal: 'Betterworks AI Agents in QA', amount: 2376, invoiceDate: '2026-02-18', dueDate: '2026-02-20', status: 'Invoiced', notes: 'Invoice BW-00001 (USD – $2,494.80 incl. cross-border charge)', attachmentUrl: '' },
  { date: '2026-06-09', account: 'ExaThought', deal: 'ExaThought Agentic AI Training – 8h', amount: 52000, invoiceDate: '', dueDate: '', status: 'Invoiced', notes: 'Proforma/Quote (no formal invoice number)', attachmentUrl: '' },
]

export async function GET(req: NextRequest) {
  const dashboardPwd = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'
  const key = req.nextUrl.searchParams.get('key') ?? ''
  if (key !== dashboardPwd) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = await getPayments()
  const existingNotes = new Set(existing.map(p => p.notes))

  const written: string[] = []
  const skipped: string[] = []

  for (const row of INVOICE_ROWS) {
    if (existingNotes.has(row.notes)) {
      skipped.push(row.notes)
      continue
    }
    await appendPaymentRowRaw(row)
    written.push(row.notes)
  }

  return NextResponse.json({ written, skipped, total: INVOICE_ROWS.length })
}
