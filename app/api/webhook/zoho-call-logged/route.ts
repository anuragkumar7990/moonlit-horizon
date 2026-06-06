import { NextRequest, NextResponse } from 'next/server'
import { getCallById, getContactById, getLeadById } from '@/lib/zoho'
import { appendCallRow, callExistsInSheetByZohoId, upsertContactIntelRow } from '@/lib/sheets'
import { syncCallIntel } from '@/lib/intel'

export const dynamic = 'force-dynamic'

const WEBHOOK_SECRET = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'

// Zoho sends Call_Start_Time as "2026-06-07T10:30:00+05:30" or UTC ISO
function parseZohoDateTime(callStartTime: string): { date: string; time: string } {
  if (!callStartTime || callStartTime === 'null') return { date: '', time: '' }
  return { date: callStartTime.slice(0, 10), time: callStartTime.slice(11, 16) }
}

async function extractCallId(req: NextRequest): Promise<string | null> {
  const fromUrl = req.nextUrl.searchParams.get('callId') ?? req.nextUrl.searchParams.get('id')
  const ct = req.headers.get('content-type') ?? ''

  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    try {
      const form = await req.formData()
      return fromUrl ?? form.get('callId')?.toString() ?? form.get('id')?.toString() ?? null
    } catch { /* fall through */ }
  }

  try {
    const text = await req.text()
    if (!text) return fromUrl
    const body = JSON.parse(text) as Record<string, unknown>
    const calls = (body?.data as Record<string, unknown>)?.Calls
    return (
      fromUrl ??
      (body.callId ? String(body.callId) : null) ??
      (body.id ? String(body.id) : null) ??
      (Array.isArray(calls) && calls[0]?.id ? String(calls[0].id) : null)
    )
  } catch { /* fall through */ }

  return fromUrl
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== WEBHOOK_SECRET) {
    console.warn('[webhook/zoho-call-logged] Rejected: bad or missing secret')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const callId = await extractCallId(req)
  if (!callId) {
    return NextResponse.json({ error: 'Could not extract Call ID from request' }, { status: 400 })
  }

  console.log(`[webhook/zoho-call-logged] callId=${callId}`)

  const call = await getCallById(callId)
  if (!call) {
    return NextResponse.json({ error: `Call ${callId} not found in Zoho` }, { status: 404 })
  }

  // Resolve contact/lead to get name, email, and account name
  let contactName = ''
  let email = ''
  let accountName = ''

  const whoId = call.whoId
  const whatId = call.whatId

  // Prefer the linked Account name from What_Id if available
  if (whatId?.module === 'Accounts' && whatId.name) {
    accountName = whatId.name
  }

  if (whoId) {
    const isLead = whoId.module === 'Leads' || call.seModule === 'Leads'
    if (isLead) {
      const lead = await getLeadById(whoId.id)
      if (lead) {
        contactName = `${lead.firstName} ${lead.lastName}`.trim()
        email = lead.email
        if (!accountName) accountName = lead.company
      }
    } else {
      const contact = await getContactById(whoId.id)
      if (contact) {
        contactName = `${contact.firstName} ${contact.lastName}`.trim()
        email = contact.email
        if (!accountName) accountName = contact.accountName
      }
    }
  }

  if (!accountName) {
    console.warn(`[webhook/zoho-call-logged] Could not resolve account name for callId=${callId}`)
    return NextResponse.json({ error: 'Could not resolve account name' }, { status: 400 })
  }

  const { date, time } = parseZohoDateTime(call.callStartTime)

  // Deduplicate: if this Zoho Call ID is already in Sheets (written by Discord /mh log call),
  // skip the Sheets append but still refresh Account Intel and Contact Intel.
  const alreadyInSheets = await callExistsInSheetByZohoId(callId)

  if (!alreadyInSheets) {
    await appendCallRow({
      date,
      time,
      account: accountName,
      contactName,
      contactPhone: '',
      sdr: call.ownerName,
      duration: call.callDuration,
      outcome: call.callResult,
      notes: call.description,
      followUpDate: '',
      zohoCallId: callId,
    })
    console.log(`[webhook/zoho-call-logged] Wrote to Sheets — ${accountName} / ${call.callResult} / ${date}`)
  } else {
    console.log(`[webhook/zoho-call-logged] Skipped Sheets write — Zoho Call ID ${callId} already present`)
  }

  // Update Account Intelligence (Call Intel layer + Cumulative Summary)
  if (accountName) {
    syncCallIntel(accountName, date).catch(e =>
      console.error('[webhook/zoho-call-logged] syncCallIntel failed:', e.message)
    )
  }

  // Update Contact Intelligence row for this contact
  if (email) {
    upsertContactIntelRow(email, {
      date,
      time,
      outcome: call.callResult,
      notes: call.description,
      duration: call.callDuration,
      zohoCallId: callId,
    }).catch(e =>
      console.error('[webhook/zoho-call-logged] upsertContactIntelRow failed:', e.message)
    )
  }

  return NextResponse.json({
    ok: true,
    callId,
    account: accountName,
    skippedSheetsWrite: alreadyInSheets,
    date,
  })
}
