import { NextRequest, NextResponse } from 'next/server'
import { convertLead, getContactById, getLeadById, getZohoAccounts, getCallById } from '@/lib/zoho'
import { bookMeeting } from '@/lib/booking'

export const dynamic = 'force-dynamic'

const WEBHOOK_SECRET = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'

// Extract call ID from any format Zoho may send:
// - form-encoded body: callId=123
// - JSON body: { callId: "123" } or { data: { Calls: [{ id: "123" }] } }
// - URL query param: ?callId=123
async function extractCallId(req: NextRequest): Promise<string | null> {
  // 1. Try URL query param (when Zoho Body=None, params go in URL)
  const fromUrl = req.nextUrl.searchParams.get('callId') ?? req.nextUrl.searchParams.get('id')
  if (fromUrl) return fromUrl

  const contentType = req.headers.get('content-type') ?? ''

  // 2. Form-encoded body (Zoho Body=x-www-form-urlencoded with module params)
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    try {
      const form = await req.formData()
      return form.get('callId')?.toString() ?? form.get('id')?.toString() ?? null
    } catch { /* fall through */ }
  }

  // 3. JSON body
  try {
    const text = await req.text()
    if (!text) return null
    const body = JSON.parse(text) as Record<string, unknown>
    if (body.callId) return String(body.callId)
    if (body.id) return String(body.id)
    // nested: { data: { Calls: [{ id }] } }
    const calls = (body?.data as Record<string, unknown>)?.Calls
    if (Array.isArray(calls) && calls[0]?.id) return String(calls[0].id)
  } catch { /* fall through */ }

  return null
}

export async function POST(req: NextRequest) {
  // Secret can arrive as X-Webhook-Secret header OR ?secret= query param
  const secret = req.headers.get('x-webhook-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== WEBHOOK_SECRET) {
    console.warn('[webhook/zoho-call] Rejected: bad or missing secret')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const callId = await extractCallId(req)
  if (!callId) {
    return NextResponse.json({ error: 'Could not extract Call ID from request. Check module parameter setup in Zoho.' }, { status: 400 })
  }

  console.log(`[webhook/zoho-call] Received callId=${callId}`)

  const call = await getCallById(callId)
  if (!call) {
    return NextResponse.json({ error: `Call ${callId} not found in Zoho` }, { status: 404 })
  }

  if (call.callResult !== 'Meeting Scheduled') {
    return NextResponse.json({ ok: true, skipped: `Call_Result is "${call.callResult}" — nothing to do` })
  }

  const proposedTime = call.proposedMeetingTime.trim()
  if (!proposedTime || proposedTime === 'null') {
    return NextResponse.json({
      error: 'Proposed_Meeting_Time is empty. SDR must set the proposed meeting time field before saving the call.',
    }, { status: 400 })
  }

  // Resolve the entity ID to act on.
  // Contact-linked call: Who_Id = Contact, What_Id = Account
  // Lead-linked call:    Who_Id = null,    What_Id = Lead,    $se_module = "Leads"
  let resolvedId = call.whoId?.id ?? ''
  const isLeadCall = !call.whoId?.id && call.seModule === 'Leads' && !!call.whatId?.id

  if (isLeadCall) resolvedId = call.whatId!.id

  if (!resolvedId) {
    return NextResponse.json({ error: 'Call has no linked Contact or Lead (Who_Id and What_Id both missing)' }, { status: 400 })
  }

  let contactId = ''
  let accountId = ''
  let accountName = ''

  // If it's a Lead (either explicit via $se_module or detected by Who_Id module), convert first.
  const isDefinitelyContact = call.whoId?.module === 'Contacts' && !isLeadCall

  if (!isDefinitelyContact) {
    const lead = await getLeadById(resolvedId)
    if (lead) {
      console.log(`[webhook/zoho-call] Converting Lead ${resolvedId} to Contact+Account`)
      const converted = await convertLead(resolvedId)
      if (!converted) {
        return NextResponse.json({ error: `Failed to convert Lead ${resolvedId}` }, { status: 500 })
      }
      contactId = converted.contactId
      accountId = converted.accountId
      accountName = converted.accountName ?? ''
      console.log(`[webhook/zoho-call] Converted → Contact ${contactId}, Account ${accountId}`)
    }
  }

  // Not a lead (or lead check skipped) — use resolved ID as Contact directly
  if (!contactId) contactId = resolvedId

  const contact = await getContactById(contactId)
  if (!contact) {
    return NextResponse.json({ error: `${resolvedId} not found as Contact or Lead in Zoho` }, { status: 404 })
  }
  if (!contact.email) {
    return NextResponse.json({
      error: `Contact ${contact.firstName} ${contact.lastName} has no email address in Zoho CRM`,
    }, { status: 400 })
  }

  if (!accountId) {
    // Use Account ID from the contact's Account lookup field (most reliable)
    if (contact.accountId) {
      accountId = contact.accountId
      accountName = contact.accountName
    } else if (call.whatId?.id && call.whatId.module === 'Accounts') {
      accountId = call.whatId.id
      accountName = call.whatId.name ?? contact.accountName
    } else if (contact.accountName) {
      // Last resort: search by name
      const accounts = await getZohoAccounts()
      const found = accounts.find(a => a.accountName === contact.accountName)
      if (found) { accountId = found.id; accountName = found.accountName }
    }
  }

  if (!accountId) {
    return NextResponse.json({
      error: `Could not resolve Account for ${contact.firstName} ${contact.lastName}. Ensure the contact is linked to an Account in Zoho.`,
    }, { status: 400 })
  }

  console.log(`[webhook/zoho-call] Booking: ${accountName} / ${contact.email} at ${proposedTime}`)

  const result = await bookMeeting({
    accountId,
    accountName,
    contactName: `${contact.firstName} ${contact.lastName}`.trim(),
    contactEmail: contact.email,
    contactPhone: contact.phone || '',
    meetingTime: proposedTime,
    meetingType: 'L1',
  })

  console.log(`[webhook/zoho-call] Done — meetingId=${result.meetingId} dealId=${result.dealId}`)
  return NextResponse.json({ ok: true, ...result })
}
