import { NextRequest, NextResponse } from 'next/server'
import { appendPaymentRow } from '@/lib/sheets'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      account: string
      deal?: string
      amount: number
      invoiceDate: string
      dueDate: string
      notes?: string
    }

    const { account, deal, amount, invoiceDate, dueDate, notes } = body

    if (!account || !amount || !invoiceDate || !dueDate) {
      return NextResponse.json(
        { error: 'account, amount, invoiceDate, dueDate are required' },
        { status: 400 }
      )
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return NextResponse.json({ error: 'Dates must be in YYYY-MM-DD format' }, { status: 400 })
    }

    await appendPaymentRow({ account, deal: deal ?? '', amount, invoiceDate, dueDate, notes })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('[log-payment]', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
