import { NextRequest, NextResponse } from 'next/server'
import { convertLead, findOrCreateAccount, linkContactToAccount, getContactById, getLeadById, getZohoAccounts, getCallById, updateLeadCompany } from '@/lib/zoho'
import { bookMeeting } from '@/lib/booking'

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com','yahoo.com','yahoo.in','yahoo.co.in','hotmail.com','hotmail.co.in',
  'outlook.com','live.com','rediffmail.com','icloud.com','me.com','mac.com',
  'protonmail.com','proton.me','aol.com','ymail.com',
])

function inferCompanyFromDomain(email: string): string {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain || FREE_EMAIL_DOMAINS.has(domain)) return ''
  const label = domain.split('.')[0]
  if (!label) return ''
  return label.length <= 4 ? label.toUpperCase() : label.charAt(0).toUpperCase() + label.slice(1)
}

export const dynamic = 'force-dynamic'

const WEBHOOK_SECRET = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'

async function parseRequest(req: NextRequest): Promise<{
  callId: string | null
  contactId: string
  accountId: string
}> {
  const fromUrl = req.nextUrl.searchParams.get('callId') ?? req.nextUrl.searchParams.get('id')
  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    try {
      const form = await req.formData()
      return {
        callId: fromUrl ?? form.get('callId')?.toString() ?? form.get('id')?.toString() ?? null,
        contactId: form.get('contactId')?.toString() ?? '',
        accountId: form.get('accountId')?.toString() ?? '',
      }
    } catch { /* fall through */ }
  }

  try {
    const text = await req.text()
    if (!text) return { callId: fromUrl, contactId: '', accountId: '' }
    const body = JSON.parse(text) as Record<string, unknown>
    const calls = (body?.data as Record<string, unknown>)?.Calls
    // Zoho Notifications API sends { ids: ["callId"], operation: "insert"|"update" }
    const fromIds = Array.isArray(body.ids) && body.ids[0] ? String(body.ids[0]) : null
    return {
      callId: fromUrl ?? (body.callId ? String(body.callId) : null) ?? (body.id ? String(body.id) : null) ?? fromIds ?? (Array.isArray(calls) && calls[0]?.id ? String(calls[0].id) : null),
      contactId: body.contactId ? String(body.contactId) : '',
      accountId: body.accountId ? String(body.accountId) : '',
    }
  } catch { /* fall through */ }

  return { callId: fromUrl, contactId: '', accountId: '' }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== WEBHOOK_SECRET) {
    console.warn('[webhook/zoho-call] Rejected: bad or missing secret')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { callId, contactId: overrideContactId, accountId: overrideAccountId } = await parseRequest(req)

  if (!callId) {
    return NextResponse.json({ error: 'Could not extract Call ID from request.' }, { status: 400 })
  }

  console.log(`[webhook/zoho-call] Received callId=${callId} contactId=${overrideContactId || 'none'} accountId=${overrideAccountId || 'none'}`)

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
      error: 'Proposed_Meeting_Time is empty. Set the proposed meeting time field before saving the call.',
    }, { status: 400 })
  }

  let contactId = overrideContactId
  let accountId = overrideAccountId
  let accountName = ''

  if (!contactId) {
    // Lead-linked call: Who_Id is null, What_Id is the Lead, $se_module = "Leads"
    const isLeadCall = !call.whoId?.id && call.seModule === 'Leads' && !!call.whatId?.id
    const resolvedId = call.whoId?.id ?? (isLeadCall ? call.whatId!.id : '')

    if (!resolvedId) {
      return NextResponse.json({ error: 'Call has no linked Contact or Lead' }, { status: 400 })
    }

    const isContact = call.whoId?.module === 'Contacts' && !isLeadCall
    if (!isContact) {
      const lead = await getLeadById(resolvedId)
      if (lead) {
        console.log(`[webhook/zoho-call] Converting Lead ${resolvedId}`)
        const converted = await convertLead(resolvedId, lead.email ?? undefined)
        if (!converted) {
          return NextResponse.json({ error: `Failed to convert Lead ${resolvedId}` }, { status: 500 })
        }
        contactId = converted.contactId
        accountId = converted.accountId
        accountName = converted.accountName ?? ''
        console.log(`[webhook/zoho-call] Converted → Contact ${contactId} Account ${accountId || 'none'}`)

        // Zoho often returns Accounts:null on conversion — find/create account and link the contact
        // Fall back to email-domain inference if company name is blank
        const resolvedCompany = lead.company
          || inferCompanyFromDomain(lead.email ?? '')
          || `Untagged Company #${resolvedId.slice(-6).toUpperCase()}`
        if (!accountId && resolvedCompany) {
          console.log(`[webhook/zoho-call] No account from conversion, finding/creating for "${resolvedCompany}"`)
          const acct = await findOrCreateAccount(resolvedCompany)
          accountId = acct.id
          accountName = acct.accountName
          await linkContactToAccount(contactId, accountId)
          console.log(`[webhook/zoho-call] Linked Contact ${contactId} → Account ${accountId}`)
          // Write inferred name back to the lead in Zoho for future use
          if (!lead.company && resolvedCompany) {
            updateLeadCompany(resolvedId, resolvedCompany).catch(() => {/* best-effort */})
          }
        }
      }
    }

    if (!contactId) contactId = resolvedId
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

  if (!accountId) {
    if (contact.accountId) {
      accountId = contact.accountId
      accountName = contact.accountName
    } else if (call.whatId?.id && call.whatId.module === 'Accounts') {
      accountId = call.whatId.id
      accountName = call.whatId.name ?? contact.accountName
    } else if (contact.accountName) {
      const accounts = await getZohoAccounts()
      const found = accounts.find(a => a.accountName === contact.accountName)
      if (found) { accountId = found.id; accountName = found.accountName }
    }
  } else {
    accountName = contact.accountName || overrideAccountId
  }

  if (!accountId) {
    return NextResponse.json({
      error: `Could not resolve Account for ${contact.firstName} ${contact.lastName}. Ensure the contact is linked to an Account in Zoho.`,
    }, { status: 400 })
  }

  // Prefer contact's own account name over the raw ID fallback
  if (!accountName) accountName = contact.accountName

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
