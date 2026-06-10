import { NextRequest, NextResponse } from 'next/server'
import { getZohoCallsInRange } from '@/lib/zoho'
import { callExistsInSheetByZohoId, getAllCallRowsFromSheet } from '@/lib/sheets'
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
  const since  = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

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

  // Re-enrich any rows that previously landed as "Untagged Company #..." — their Zoho leads
  // may now have company/email filled in (e.g. after a webinar batch import gets enriched).
  const reenrichResults: { callId: string; status: string; account?: string }[] = []
  try {
    const allRows = await getAllCallRowsFromSheet()
    const untagged = Array.from(allRows.entries()).filter(([, v]) => v.account.startsWith('Untagged Company #'))
    for (const [callId, existingRow] of untagged) {
      try {
        const r = await processZohoCall(callId, { existingRow })
        const wasResolved = !r.account.startsWith('Untagged Company')
        reenrichResults.push({ callId, status: wasResolved ? 'reenriched' : 'still_untagged', account: r.account })
      } catch (e) {
        reenrichResults.push({ callId, status: 'error', account: String(e) })
      }
    }
    const resolved = reenrichResults.filter(r => r.status === 'reenriched').length
    if (untagged.length > 0) {
      console.log(`[sync-zoho-calls] re-enrich: total=${untagged.length} resolved=${resolved}`)
    }
  } catch (e) {
    console.error('[sync-zoho-calls] re-enrich pass failed:', e)
  }

  return NextResponse.json({ since, until, synced, skipped, junk, errors, total: callsInRange.length, results, reenrichResults })
}
