import { NextRequest, NextResponse } from 'next/server'
import { findDealByName, findOrCreateAccount, createDeal } from '@/lib/zoho'

export const dynamic = 'force-dynamic'

const SECRET = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'

export async function POST(req: NextRequest) {
  const pwd = req.headers.get('x-dashboard-password') ?? req.nextUrl.searchParams.get('password')
  if (pwd !== SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as {
    account?: string
    contactName?: string
    contactEmail?: string
    contactPhone?: string
  }

  const account = String(body.account ?? '').trim()
  if (!account) return NextResponse.json({ error: 'account is required' }, { status: 400 })

  const existing = await findDealByName(account)
  if (existing) {
    return NextResponse.json({ ok: true, existing: true, message: `Deal already exists for ${account}` })
  }

  const { id: accountId } = await findOrCreateAccount(account)

  const closingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)

  const dealId = await createDeal({
    accountId,
    accountName: account,
    contactName: body.contactName ?? '',
    contactEmail: body.contactEmail ?? '',
    contactPhone: body.contactPhone ?? '',
    stage: 'Discovery Call booked',
    closingDate,
    dateOfFirstContact: today,
  })

  return NextResponse.json({ ok: true, existing: false, dealId, accountId })
}
