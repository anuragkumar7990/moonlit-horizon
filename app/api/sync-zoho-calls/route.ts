import { NextRequest, NextResponse } from 'next/server'
import { getZohoCallsInRange } from '@/lib/zoho'
import { callExistsInSheetByZohoId } from '@/lib/sheets'
import { processZohoCall } from '@/lib/zoho-call-processor'

export const dynamic = 'force-dynamic'

// Hourly cron: syncs Zoho calls from the last 2 hours to the Calls sheet.
// Secured by CRON_SECRET in the Authorization header (set by Vercel cron).
// Also accepts ?key=<DASHBOARD_PASSWORD> for manual runs.

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''
  const dashboardPwd = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'
  const manualKey = req.nextUrl.searchParams.get('key') ?? ''

  const isCron   = cronSecret && authHeader === `Bearer ${cronSecret}`
  const isManual = manualKey === dashboardPwd

  if (!isCron && !isManual) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now    = new Date()
  const until  = now.toISOString().slice(0, 10)
  const since  = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString().slice(0, 10)

  let callsInRange: { id: string; date: string }[]
  try {
    callsInRange = await getZohoCallsInRange(since, until)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }

  const results: { callId: string; status: string; account?: string }[] = []

  for (const c of callsInRange) {
    try {
      const exists = await callExistsInSheetByZohoId(c.id)
      if (exists) {
        results.push({ callId: c.id, status: 'already_synced' })
        continue
      }
      const r = await processZohoCall(c.id)
      results.push({
        callId: c.id,
        status: r.skippedSheetsWrite ? 'junk_skipped' : 'synced',
        account: r.account,
      })
    } catch (e) {
      results.push({ callId: c.id, status: 'error', account: String(e) })
    }
  }

  const synced  = results.filter(r => r.status === 'synced').length
  const skipped = results.filter(r => r.status === 'already_synced').length
  const junk    = results.filter(r => r.status === 'junk_skipped').length
  const errors  = results.filter(r => r.status === 'error').length

  console.log(`[sync-zoho-calls] since=${since} until=${until} total=${callsInRange.length} synced=${synced} skipped=${skipped} junk=${junk} errors=${errors}`)

  return NextResponse.json({ since, until, synced, skipped, junk, errors, total: callsInRange.length, results })
}
