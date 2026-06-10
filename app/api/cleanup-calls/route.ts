import { NextRequest, NextResponse } from 'next/server'
import { deleteCallRowsByAccountNames } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

// Removes Calls sheet rows with known-bad account names.
// POST body: { accountNames: string[] }  (defaults to the standard junk list if omitted)
// Auth: ?key=<DASHBOARD_PASSWORD>

const DEFAULT_JUNK = ['india', 'the test tribe', '123', 'mt', 'test', 'test1', 'test call']

export async function POST(req: NextRequest) {
  const manualKey = req.nextUrl.searchParams.get('key') ?? ''
  const dashboardPwd = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'
  if (manualKey !== dashboardPwd) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as { accountNames?: string[] }
  const accountNames = body.accountNames ?? DEFAULT_JUNK

  const deleted = await deleteCallRowsByAccountNames(accountNames)
  return NextResponse.json({ deleted, accountNames })
}
