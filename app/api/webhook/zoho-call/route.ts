import { NextRequest, NextResponse } from 'next/server'
import { convertLead, getContactById, getZohoAccounts } from '@/lib/zoho'
import { bookMeeting } from '@/lib/booking'

export const dynamic = 'force-dynamic'

const WEBHOOK_SECRET = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== WEBHOOK_SECRET) {
    console.warn('[webhook/zoho-call] Rejected: bad or missing X-Webhook-Secret')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Zoho sends the payload in various shapes depending on workflow config.
  // We try to extract the first Call record from any of them.
  let callData: Record<string, unknown> | null = null
  const b = body as Record<string, unknown>

  if (b?.data && typeof b.data === 'object') {
    const d = b.data as Record<string, unknown>
    if (Array.isArray(d?.Calls) && d.Calls.length > 0) {
      callData = d.Calls[0] as Record<string, unknown>
    }
  }
  if (!callData && Array.isArray(b?.Calls) && (b.Calls as unknown[]).length > 0) {
    callData = (b.Calls as Record<string, unknown>[])[0]
  }
  if (!callData && Array.isArray(body)) {
    const first = (body as Record<string, unknown>[])[0]
    if (first?.Calls) callData = first.Calls as Record<string, unknown>
  }

  if (!callData) {
    console.error('[webhook/zoho-call] Unrecognised payload:', JSON.stringify(body))
    return NextResponse.json({ error: 'Could not parse Call data from payload' }, { status: 400 })
  }

  const callResult = String(callData.Call_Result ?? '')
  if (callResult !== 'Meeting Scheduled') {
    return NextResponse.json({ ok: true, skipped: `Call_Result is "${callResult}" — nothing to do` })
  }

  const proposedTime = String(callData.Proposed_Meeting_Time ?? '').trim()
  if (!proposedTime || proposedTime === 'null') {
    return NextResponse.json({
      error: 'Proposed_Meeting_Time is empty. SDR must set the proposed meeting time before saving.',
    }, { status: 400 })
  }

  const whoIdRaw = callData.Who_Id as { id?: string; module?: string; name?: string } | null
  if (!whoIdRaw?.id) {
    return NextResponse.json({ error: 'Call has no linked Contact or Lead (Who_Id missing)' }, { status: 400 })
  }

  let contactId = whoIdRaw.id
  let accountId = ''
  let accountName = ''

  // If the call is linked to a Lead, convert it first
  if (whoIdRaw.module === 'Leads') {
    console.log(`[webhook/zoho-call] Converting Lead ${contactId} to Contact+Account`)
    const converted = await convertLead(contactId)
    if (!converted) {
      return NextResponse.json({ error: `Failed to convert Lead ${contactId}` }, { status: 500 })
    }
    contactId = converted.contactId
    accountId = converted.accountId
    accountName = converted.accountName ?? ''
    console.log(`[webhook/zoho-call] Lead converted → Contact ${contactId}, Account ${accountId}`)
  }

  const contact = await getContactById(contactId)
  if (!contact) {
    return NextResponse.json({ error: `Contact ${contactId} not found in Zoho` }, { status: 404 })
  }
  if (!contact.email) {
    return NextResponse.json({
      error: `Contact ${contact.firstName} ${contact.lastName} has no email address in Zoho CRM`,
    }, { status: 400 })
  }

  // Resolve Account if not already set from Lead conversion
  if (!accountId) {
    const whatId = callData.What_Id as { id?: string; module?: string; name?: string } | null
    if (whatId?.id && whatId.module === 'Accounts') {
      accountId = whatId.id
      accountName = whatId.name ?? contact.accountName
    } else if (contact.accountName) {
      const accounts = await getZohoAccounts()
      const found = accounts.find(a => a.accountName === contact.accountName)
      if (found) {
        accountId = found.id
        accountName = found.accountName
      }
    }
  }

  if (!accountId) {
    return NextResponse.json({
      error: `Could not resolve an Account for contact ${contact.firstName} ${contact.lastName}. Link the call to an Account or make sure the contact has an Account in Zoho.`,
    }, { status: 400 })
  }

  console.log(`[webhook/zoho-call] Booking meeting for ${accountName} / ${contact.email} at ${proposedTime}`)

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
