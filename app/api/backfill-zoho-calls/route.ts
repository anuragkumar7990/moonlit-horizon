import { NextRequest, NextResponse } from 'next/server'
import { getZohoCallsInRange } from '@/lib/zoho'
import { callExistsInSheetByZohoId } from '@/lib/sheets'
import { processZohoCall } from '@/lib/zoho-call-processor'

export const dynamic = 'force-dynamic'

const SECRET = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'

// GET  — preview: show which calls in the range are missing from the sheet
// POST — actually sync missing calls
//
// Params: since=yyyy-mm-dd (default: 7 days ago) until=yyyy-mm-dd (default: today)
// Auth:   ?password=thetesttribe or x-dashboard-password header

export async function GET(req: NextRequest) {
  const pwd = req.headers.get('x-dashboard-password') ?? req.nextUrl.searchParams.get('password')
  if (pwd !== SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { since, until } = getRange(req)
  const zohoCallIds = await getZohoCallsInRange(since, until)

  const missing: string[] = []
  for (const c of zohoCallIds) {
    const exists = await callExistsInSheetByZohoId(c.id)
    if (!exists) missing.push(c.id)
  }

  return NextResponse.json({
    since, until,
    totalInZoho: zohoCallIds.length,
    alreadySynced: zohoCallIds.length - missing.length,
    missingCount: missing.length,
    missingIds: missing,
  })
}

export async function POST(req: NextRequest) {
  const pwd = req.headers.get('x-dashboard-password') ?? req.nextUrl.searchParams.get('password')
  if (pwd !== SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { since?: string; until?: string; dryRun?: boolean; callIds?: string[] }
  const dryRun = body.dryRun === true

  let callIds: string[]

  if (Array.isArray(body.callIds) && body.callIds.length > 0) {
    // Explicit list of call IDs
    callIds = body.callIds.map(String)
  } else {
    // Date range
    const since = body.since ?? daysAgo(7)
    const until = body.until ?? today()
    const zohoCallIds = await getZohoCallsInRange(since, until)
    callIds = zohoCallIds.map(c => c.id)
  }

  const results: { callId: string; status: string; account?: string; skipped?: boolean }[] = []

  for (const callId of callIds) {
    const exists = await callExistsInSheetByZohoId(callId)
    if (exists) {
      results.push({ callId, status: 'already_synced' })
      continue
    }
    if (dryRun) {
      results.push({ callId, status: 'would_sync' })
      continue
    }
    try {
      const r = await processZohoCall(callId)
      results.push({ callId, status: r.ok ? 'synced' : 'error', account: r.account, skipped: r.skippedSheetsWrite })
    } catch (e) {
      results.push({ callId, status: 'error', account: String((e as Error).message) })
    }
  }

  const synced  = results.filter(r => r.status === 'synced').length
  const skipped = results.filter(r => r.status === 'already_synced').length
  return NextResponse.json({ dryRun, synced, skipped, total: results.length, results })
}

function today() { return new Date().toISOString().slice(0, 10) }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10)
}
function getRange(req: NextRequest) {
  return {
    since: req.nextUrl.searchParams.get('since') ?? daysAgo(7),
    until: req.nextUrl.searchParams.get('until') ?? today(),
  }
}
