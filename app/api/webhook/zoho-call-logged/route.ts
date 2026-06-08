import { NextRequest, NextResponse } from 'next/server'
import { getCallById, getContactById, getLeadById, updateLeadCompany } from '@/lib/zoho'
import { appendCallRow, callExistsInSheetByZohoId, upsertContactIntelRow } from '@/lib/sheets'
import { syncCallIntel } from '@/lib/intel'

export const dynamic = 'force-dynamic'

const WEBHOOK_SECRET = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'yahoo.in', 'yahoo.co.in',
  'hotmail.com', 'hotmail.co.in', 'outlook.com', 'live.com',
  'rediffmail.com', 'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me', 'aol.com', 'ymail.com',
])

// Infers a display company name from an email domain.
// Corporate: ptc.com → "PTC", indusface.com → "Indusface"
// Free provider (gmail etc): returns '' — caller should fall back to Untagged Company tag
function inferCompanyFromDomain(email: string): string {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain || FREE_EMAIL_DOMAINS.has(domain)) return ''
  const label = domain.split('.')[0]
  if (!label) return ''
  return label.length <= 4
    ? label.toUpperCase()
    : label.charAt(0).toUpperCase() + label.slice(1)
}

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
    // Zoho Notifications API sends { ids: ["callId"], operation: "insert"|"update" }
    const fromIds = Array.isArray(body.ids) && body.ids[0] ? String(body.ids[0]) : null
    return (
      fromUrl ??
      (body.callId ? String(body.callId) : null) ??
      (body.id ? String(body.id) : null) ??
      fromIds ??
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

  // Resolve contact/lead to get name, email, and account name.
  //
  // Zoho's call structure differs by record type:
  //   Lead calls:    $se_module="Leads",    Who_Id=null, What_Id={ id: leadId, name }
  //   Contact calls: $se_module="Contacts", Who_Id={ id: contactId, name }, What_Id=null (or Account)
  let contactName = ''
  let email = ''
  let accountName = ''
  let leadIdForUpdate: string | null = null  // tracked so we can write company back to Zoho

  const whoId = call.whoId
  const whatId = call.whatId

  if (call.seModule === 'Leads') {
    // Lead call — the lead record is in What_Id
    const leadId = whatId?.id
    if (leadId) {
      leadIdForUpdate = leadId
      const lead = await getLeadById(leadId)
      if (lead) {
        contactName = `${lead.firstName} ${lead.lastName}`.trim()
        email = lead.email
        accountName = lead.company
      }
    }
    // Fallback: use What_Id name if lead fetch returned nothing (converted/deleted lead)
    if (!contactName && whatId?.name) contactName = whatId.name
  } else {
    // Contact call — contact is in Who_Id; account may be in What_Id
    if (whoId?.id) {
      const contact = await getContactById(whoId.id)
      if (contact) {
        contactName = `${contact.firstName} ${contact.lastName}`.trim()
        email = contact.email
        accountName = contact.accountName
      }
    }
    // Fallback: use Who_Id name if contact fetch returned nothing
    if (!contactName && whoId?.name) contactName = whoId.name
    // Fallback: account name from What_Id if contact had none
    if (!accountName && whatId?.name) accountName = whatId.name
  }

  // Fallback: infer company from email domain when Zoho Company_Name is blank
  if (!accountName && email) {
    accountName = inferCompanyFromDomain(email)
      || `Untagged Company #${callId.slice(-6).toUpperCase()}`
    console.log(`[webhook/zoho-call-logged] Inferred company "${accountName}" from email for callId=${callId}`)

    // Write inferred name back to Zoho (skip for Untagged entries — those need human correction)
    if (!accountName.startsWith('Untagged') && leadIdForUpdate) {
      updateLeadCompany(leadIdForUpdate, accountName).catch(e =>
        console.error('[webhook/zoho-call-logged] updateLeadCompany failed:', e.message)
      )
    }
  }

  // Last resort: always log the call even if we can't resolve account/email.
  // Use Untagged Company so nothing is silently dropped.
  if (!accountName) {
    accountName = `Untagged Company #${callId.slice(-6).toUpperCase()}`
    console.warn(`[webhook/zoho-call-logged] No account resolved — using "${accountName}" for callId=${callId}`)
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
