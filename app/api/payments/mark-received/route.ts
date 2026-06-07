import { NextRequest, NextResponse } from 'next/server'
import { updatePaymentStatus } from '@/lib/sheets'
import type { Payment } from '@/lib/sheets'

export async function POST(req: NextRequest) {
  try {
    const { rowIndex, status } = await req.json() as { rowIndex: number; status: Payment['status'] }
    if (!rowIndex || !status) {
      return NextResponse.json({ error: 'rowIndex and status are required' }, { status: 400 })
    }
    await updatePaymentStatus(rowIndex, status)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
