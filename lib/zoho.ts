import type { ZohoDeal, ZohoContact, ZohoAccount, LeadCounts } from './types'

const BASE_URL = 'https://www.zohoapis.in/crm/v3'

let _tokenCache: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt) return _tokenCache.token

  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
    client_id: process.env.ZOHO_CLIENT_ID!,
    client_secret: process.env.ZOHO_CLIENT_SECRET!,
    grant_type: 'refresh_token',
  })
  const res = await fetch(`https://accounts.zoho.in/oauth/v2/token?${params.toString()}`, {
    method: 'POST',
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Zoho token refresh failed: ${JSON.stringify(data)}`)
  _tokenCache = { token: data.access_token as string, expiresAt: Date.now() + 55 * 60 * 1000 }
  return _tokenCache.token
}

async function zohoGet(path: string): Promise<unknown> {
  const token = await getAccessToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
    cache: 'no-store',
  })
  const text = await res.text()
  return text ? JSON.parse(text) : {}
}

export async function getDeals(): Promise<ZohoDeal[]> {
  const results: ZohoDeal[] = []
  let page = 1
  while (true) {
    const data = await zohoGet(`/Deals?fields=Deal_Name,Stage,Amount,Closing_Date,Account_Name,Contact_Full_Name,Tag&per_page=200&page=${page}`) as { data?: Record<string, unknown>[]; info?: { more_records?: boolean } }
    for (const d of data.data ?? []) {
      const tags = Array.isArray(d.Tag) ? (d.Tag as Record<string, unknown>[]).map(t => String(t.name ?? '')) : []
      const temperature: ZohoDeal['temperature'] = tags.includes('Hot') ? 'Hot' : tags.includes('Warm') ? 'Warm' : tags.includes('Cold') ? 'Cold' : null
      results.push({
        id: String(d.id ?? ''),
        dealName: String(d.Deal_Name ?? ''),
        stage: String(d.Stage ?? ''),
        amount: String(d.Amount ?? ''),
        closingDate: String(d.Closing_Date ?? ''),
        accountName: typeof d.Account_Name === 'object' && d.Account_Name !== null ? String((d.Account_Name as Record<string, unknown>).name ?? '') : String(d.Account_Name ?? ''),
        contactName: String(d.Contact_Full_Name ?? ''),
        temperature,
      })
    }
    if (!data.info?.more_records) break
    page++
  }
  return results
}

export async function addTagToDeals(ids: string[], tagName: string): Promise<void> {
  if (ids.length === 0) return
  const token = await getAccessToken()
  const BATCH = 50
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH)
    const params = new URLSearchParams({ tag_names: tagName })
    batch.forEach(id => params.append('ids[]', id))
    await fetch(`${BASE_URL}/Deals/actions/add_tags?${params.toString()}`, {
      method: 'POST',
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    })
  }
}

export async function removeTagFromDeals(ids: string[], tagName: string): Promise<void> {
  if (ids.length === 0) return
  const token = await getAccessToken()
  const BATCH = 50
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH)
    const params = new URLSearchParams({ tag_names: tagName })
    batch.forEach(id => params.append('ids[]', id))
    await fetch(`${BASE_URL}/Deals/actions/remove_tags?${params.toString()}`, {
      method: 'POST',
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    })
  }
}

export async function getDealByAccount(accountName: string): Promise<ZohoDeal | null> {
  const all = await getDeals()
  return all.find(d => d.accountName.toLowerCase() === accountName.toLowerCase()) ?? null
}

export async function getContacts(): Promise<ZohoContact[]> {
  const token = await getAccessToken()
  const results: ZohoContact[] = []
  let page = 1
  while (true) {
    const res = await fetch(
      `${BASE_URL}/Contacts?fields=First_Name,Last_Name,Email,Phone,Mobile,Account_Contact&per_page=200&page=${page}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` }, cache: 'no-store' }
    )
    const data = await res.json() as { data?: Record<string, unknown>[]; info?: { more_records?: boolean } }
    const rows = data.data ?? []
    for (const c of rows) {
      const acct = typeof c.Account_Contact === 'object' && c.Account_Contact !== null ? c.Account_Contact as Record<string, unknown> : null
      results.push({
        id:          String(c.id ?? ''),
        firstName:   String(c.First_Name ?? ''),
        lastName:    String(c.Last_Name ?? ''),
        email:       String(c.Email ?? ''),
        phone:       String(c.Phone ?? c.Mobile ?? ''),
        accountId:   String(acct?.id ?? ''),
        accountName: String(acct?.name ?? ''),
      })
    }
    if (!data.info?.more_records || rows.length < 200) break
    page++
  }
  return results
}

export async function getZohoAccounts(): Promise<ZohoAccount[]> {
  const data = await zohoGet('/Accounts?fields=Account_Name&per_page=200') as { data?: Record<string, unknown>[] }
  return (data.data ?? []).map((a) => ({
    id: String(a.id ?? ''),
    accountName: String(a.Account_Name ?? ''),
  }))
}

export async function createLeads(leads: {
  firstName: string
  lastName: string
  company: string
  email: string
  phone?: string
  designation?: string
  city?: string
  leadStatus?: string
  lvl1Source?: string
  lvl2Source?: string
  priority?: string
}[]): Promise<{
  results: { row: number; status: 'created' | 'skipped' | 'error'; id?: string; reason?: string }[]
}> {
  const token = await getAccessToken()

  // Zoho allows max 100 records per POST — split into batches
  const BATCH_SIZE = 100
  const allResults: { row: number; status: 'created' | 'skipped' | 'error'; id?: string; reason?: string }[] = []

  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE)
    const data = batch.map(l => ({
      First_Name: l.firstName || undefined,
      Last_Name: l.lastName,
      Company: l.company || undefined,
      Company_Name: l.company || undefined,
      Email: l.email,
      Mobile: l.phone || undefined,
      Designation: l.designation || undefined,
      City: l.city || undefined,
      Lead_Source: 'Internal Community Data',
      Lead_Status: l.leadStatus || 'Not Contacted',
      Lvl_1_Source: l.lvl1Source || undefined,
      Lvl_2_Source: l.lvl2Source || undefined,
      Tag: l.priority ? [{ name: l.priority }] : undefined,
    }))
    const res = await fetch(`${BASE_URL}/Leads`, {
      method: 'POST',
      headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, trigger: [] }),
    })
    const json = await res.json() as { data?: { code: string; status: string; details?: { id: string }; message?: string }[] }
    const batchResults = (json.data ?? []).map((r, j) => {
      const row = i + j + 1
      if (r.status === 'success' || r.code === 'SUCCESS') {
        return { row, status: 'created' as const, id: r.details?.id }
      } else if (r.code === 'DUPLICATE_DATA') {
        return { row, status: 'skipped' as const, reason: 'Already exists in Zoho' }
      } else {
        return { row, status: 'error' as const, reason: r.message ?? r.code }
      }
    })
    // If Zoho returned no data array, mark whole batch as errors
    if (!json.data) {
      for (let j = 0; j < batch.length; j++) {
        allResults.push({ row: i + j + 1, status: 'error', reason: 'Zoho returned no response for this batch' })
      }
    } else {
      allResults.push(...batchResults)
    }
  }

  return { results: allResults }
}

export async function getLeads(): Promise<{ id: string; firstName: string; lastName: string; email: string; phone: string; company: string }[]> {
  const token = await getAccessToken()
  const results: { id: string; firstName: string; lastName: string; email: string; phone: string; company: string }[] = []
  let page = 1
  while (true) {
    const res = await fetch(
      `${BASE_URL}/Leads?fields=First_Name,Last_Name,Email,Phone,Mobile,Company,Company_Name,Converted__s&per_page=200&page=${page}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` }, cache: 'no-store' }
    )
    const data = await res.json() as { data?: Record<string, unknown>[]; info?: { more_records?: boolean } }
    const rows = data.data ?? []
    for (const l of rows) {
      if (l.Converted__s) continue
      results.push({
        id:        String(l.id ?? ''),
        firstName: String(l.First_Name ?? ''),
        lastName:  String(l.Last_Name ?? ''),
        email:     String(l.Email ?? ''),
        phone:     String(l.Phone ?? l.Mobile ?? ''),
        company:   String(l.Company ?? l.Company_Name ?? ''),
      })
    }
    if (!data.info?.more_records || rows.length < 200) break
    page++
  }
  return results
}

export async function getLeadById(id: string): Promise<{ id: string; firstName: string; lastName: string; email: string; phone: string; company: string; designation: string } | null> {
  try {
    const data = await zohoGet(`/Leads/${id}?fields=First_Name,Last_Name,Email,Phone,Mobile,Company,Company_Name,Designation,Title`) as { data?: Record<string, unknown>[] }
    const l = data.data?.[0]
    if (!l) return null
    return {
      id: String(l.id ?? ''),
      firstName: String(l.First_Name ?? ''),
      lastName: String(l.Last_Name ?? ''),
      email: String(l.Email ?? ''),
      phone: String(l.Phone ?? l.Mobile ?? ''),
      company: String(l.Company ?? l.Company_Name ?? ''),
      designation: String(l.Designation ?? l.Title ?? ''),
    }
  } catch { return null }
}

export async function getContactById(id: string): Promise<ZohoContact & { designation: string } | null> {
  const data = await zohoGet(`/Contacts/${id}?fields=First_Name,Last_Name,Email,Phone,Mobile,Account_Contact,Designation,Title`) as { data?: Record<string, unknown>[] }
  const c = data.data?.[0]
  if (!c) return null
  const accountLookup = typeof c.Account_Contact === 'object' && c.Account_Contact !== null
    ? c.Account_Contact as Record<string, unknown>
    : null
  return {
    id: String(c.id ?? ''),
    firstName: String(c.First_Name ?? ''),
    lastName: String(c.Last_Name ?? ''),
    email: String(c.Email ?? ''),
    phone: String(c.Phone ?? c.Mobile ?? ''),
    accountId: String(accountLookup?.id ?? ''),
    accountName: String(accountLookup?.name ?? ''),
    designation: String(c.Designation ?? c.Title ?? ''),
  }
}

export async function getCallById(id: string): Promise<{
  id: string
  callResult: string
  proposedMeetingTime: string
  seModule: string
  whoId: { id: string; module: string; name: string } | null
  whatId: { id: string; module: string; name: string } | null
  callStartTime: string
  callDuration: string
  description: string
  ownerName: string
} | null> {
  const data = await zohoGet(
    `/Calls/${id}?fields=id,Call_Result,Proposed_Meeting_Time,$se_module,Who_Id,What_Id,Call_Start_Time,Call_Duration,Description,Owner`
  ) as { data?: Record<string, unknown>[] }
  const c = data.data?.[0]
  if (!c) return null
  const whoId = c.Who_Id && typeof c.Who_Id === 'object'
    ? c.Who_Id as { id: string; module: string; name: string }
    : null
  const whatId = c.What_Id && typeof c.What_Id === 'object'
    ? c.What_Id as { id: string; module: string; name: string }
    : null
  const owner = c.Owner && typeof c.Owner === 'object'
    ? c.Owner as { id: string; name: string }
    : null
  return {
    id: String(c.id ?? ''),
    callResult: String(c.Call_Result ?? ''),
    proposedMeetingTime: String(c.Proposed_Meeting_Time ?? ''),
    seModule: String(c.$se_module ?? ''),
    whoId,
    whatId,
    callStartTime: String(c.Call_Start_Time ?? ''),
    callDuration: String(c.Call_Duration ?? ''),
    description: String(c.Description ?? ''),
    ownerName: owner?.name ?? '',
  }
}

// Outcome mapping: our system → Zoho
const OUTCOME_TO_ZOHO: Record<string, string> = {
  'meeting booked':  'Meeting Scheduled',
  'connected':       'Interested',
  'not interested':  'Not Interested',
  'callback later':  'Call Back Later',
  'send more info':  'Send More Info',
  'no answer':       'No Answer',
  'voicemail':       'Left Voice Message',
  'busy':            'Busy',
  'wrong number':    'Wrong Number',
}

// Zoho outcomes that count as "connected" for weekly summary stats
export const ZOHO_CONNECTED_OUTCOMES = new Set([
  'Meeting Scheduled', 'Interested', 'Not Interested', 'Call Back Later', 'Send More Info',
  // also our own values in case Sheet calls are mixed in
  'meeting booked', 'connected', 'not interested', 'callback later', 'send more info',
])

export async function getZohoCalls(): Promise<{
  id: string
  date: string
  accountName: string
  contactName: string
  outcome: string
}[]> {
  try {
    const token = await getAccessToken()
    const results: { id: string; date: string; accountName: string; contactName: string; outcome: string }[] = []
    let page = 1
    while (true) {
      const res = await fetch(
        `${BASE_URL}/Calls?fields=id,Call_Start_Time,Call_Result,What_Id,Who_Id&per_page=200&page=${page}&sort_by=id&sort_order=desc`,
        { headers: { Authorization: `Zoho-oauthtoken ${token}` }, cache: 'no-store' }
      )
      const data = await res.json() as { data?: Record<string, unknown>[]; info?: { more_records?: boolean } }
      const rows = data.data ?? []
      for (const c of rows) {
        const whatId = c.What_Id && typeof c.What_Id === 'object' ? c.What_Id as Record<string, unknown> : null
        const whoId  = c.Who_Id  && typeof c.Who_Id  === 'object' ? c.Who_Id  as Record<string, unknown> : null
        const accountName = whatId ? String(whatId.name ?? '') : (whoId ? String(whoId.name ?? '') : '')
        const contactName = whoId ? String(whoId.name ?? '') : ''
        const rawTime = String(c.Call_Start_Time ?? '')
        const date = rawTime ? rawTime.slice(0, 10) : ''
        if (date && accountName) {
          results.push({ id: String(c.id ?? ''), date, accountName, contactName, outcome: String(c.Call_Result ?? '') })
        }
      }
      if (!data.info?.more_records || rows.length < 200) break
      page++
    }
    return results
  } catch { return [] }
}

export async function createZohoCall(params: {
  contactId: string
  contactType: 'lead' | 'contact'
  accountName: string
  outcome: string
  notes?: string
}): Promise<string | null> {
  const token = await getAccessToken()
  const now = new Date()
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
  const callStartTime = ist.toISOString().replace('Z', '+05:30')

  const zohoOutcome = OUTCOME_TO_ZOHO[params.outcome] ?? params.outcome
  const whoModule = params.contactType === 'lead' ? 'Leads' : 'Contacts'

  const res = await fetch(`${BASE_URL}/Calls`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [{
        Subject: `Outbound Call — ${params.accountName}`,
        Call_Type: 'Outbound',
        Call_Start_Time: callStartTime,
        Call_Duration: '00:05:00',
        Call_Result: zohoOutcome,
        Description: params.notes ?? '',
        Who_Id: { id: params.contactId, module: whoModule },
      }],
    }),
  })
  const json = await res.json() as { data?: { details?: { id?: string } }[] }
  return json.data?.[0]?.details?.id ?? null
}

export async function updateLeadStatus(leadId: string, status: string): Promise<void> {
  const token = await getAccessToken()
  await fetch(`${BASE_URL}/Leads/${leadId}`, {
    method: 'PUT',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [{ id: leadId, Lead_Status: status }] }),
  })
}

export async function updateLeadCompany(leadId: string, company: string): Promise<void> {
  const token = await getAccessToken()
  await fetch(`${BASE_URL}/Leads/${leadId}`, {
    method: 'PUT',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [{ id: leadId, Company: company, Company_Name: company }] }),
  })
}

export async function linkContactToAccount(contactId: string, accountId: string): Promise<void> {
  const token = await getAccessToken()
  await fetch(`${BASE_URL}/Contacts`, {
    method: 'PUT',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [{ id: contactId, Account_Contact: { id: accountId } }] }),
  })
}

export async function findOrCreateAccount(name: string): Promise<{ id: string; accountName: string }> {
  const accounts = await getZohoAccounts()
  const existing = accounts.find(a => a.accountName.toLowerCase() === name.toLowerCase())
  if (existing) return existing

  const token = await getAccessToken()
  const res = await fetch(`${BASE_URL}/Accounts`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [{ Account_Name: name }] }),
  })
  const data = await res.json() as { data?: { details?: { id: string } }[] }
  const id = data.data?.[0]?.details?.id
  if (!id) throw new Error(`Failed to create Account for "${name}"`)
  return { id, accountName: name }
}

// ── Top-250 re-ranker helpers ─────────────────────────────────────────────────

export interface ScoringLead {
  id: string
  designation: string
  tags: string[]
  lvl1Source: string
  leadStatus: string
}

export async function getAllLeadsForScoring(): Promise<ScoringLead[]> {
  const token = await getAccessToken()
  const results: ScoringLead[] = []
  let page = 1
  while (true) {
    const res = await fetch(
      `${BASE_URL}/Leads?fields=id,Designation,Tag,Lvl_1_Source,Lead_Status&per_page=200&page=${page}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` }, cache: 'no-store' }
    )
    const data = await res.json() as { data?: Record<string, unknown>[]; info?: { more_records?: boolean } }
    const rows = data.data ?? []
    for (const r of rows) {
      results.push({
        id:          String(r.id ?? ''),
        designation: String(r.Designation ?? ''),
        tags:        Array.isArray(r.Tag) ? (r.Tag as { name: string }[]).map(t => t.name ?? '') : [],
        lvl1Source:  String(r.Lvl_1_Source ?? ''),
        leadStatus:  String(r.Lead_Status ?? ''),
      })
    }
    if (!data.info?.more_records || rows.length < 200) break
    page++
  }
  return results
}

export async function addTagToLeads(ids: string[], tagName: string): Promise<void> {
  if (ids.length === 0) return
  const token = await getAccessToken()
  const BATCH = 50
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH)
    const params = new URLSearchParams({ tag_names: tagName })
    batch.forEach(id => params.append('ids[]', id))
    await fetch(`${BASE_URL}/Leads/actions/add_tags?${params.toString()}`, {
      method: 'POST',
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    })
  }
}

export async function removeTagFromLeads(ids: string[], tagName: string): Promise<void> {
  if (ids.length === 0) return
  const token = await getAccessToken()
  const BATCH = 50
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH)
    const params = new URLSearchParams({ tag_names: tagName })
    batch.forEach(id => params.append('ids[]', id))
    await fetch(`${BASE_URL}/Leads/actions/remove_tags?${params.toString()}`, {
      method: 'POST',
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    })
  }
}

export async function findContactByEmail(email: string): Promise<{
  contactId: string
  accountId: string
  contactName?: string
  accountName?: string
} | null> {
  const token = await getAccessToken()
  const res = await fetch(
    `${BASE_URL}/Contacts/search?criteria=(Email:equals:${encodeURIComponent(email)})&fields=id,Full_Name,Account_Name,Account_Id`,
    { headers: { Authorization: `Zoho-oauthtoken ${token}` }, cache: 'no-store' }
  )
  const data = await res.json() as { data?: { id: string; Full_Name?: string; Account_Name?: string; Account_Id?: string }[] }
  const c = data.data?.[0]
  if (!c?.id) return null
  return {
    contactId: c.id,
    contactName: c.Full_Name,
    accountId: c.Account_Id ?? '',
    accountName: c.Account_Name,
  }
}

export async function convertLead(leadId: string, leadEmail?: string): Promise<{
  contactId: string
  accountId: string
  contactName?: string
  accountName?: string
} | null> {
  const token = await getAccessToken()
  const res = await fetch(`${BASE_URL}/Leads/${leadId}/actions/convert`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [{
        overwrite: true,
        notify_lead_owner: false,
        notify_new_entity_owner: false,
      }]
    }),
  })
  const text = await res.text()
  console.log(`[convertLead] status=${res.status} body=${text}`)
  if (!text) return null
  const data = JSON.parse(text) as {
    data?: {
      code: string
      status: string
      details?: {
        Contacts?: { id: string; name?: string } | null
        Accounts?: { id: string; name?: string } | null
      }
    }[]
  }
  const item = data.data?.[0]
  // Lead already converted — look up the existing contact by email
  if (item?.code === 'ALREADY_CONVERTED' && leadEmail) {
    console.log(`[convertLead] Lead ${leadId} already converted — looking up contact by email ${leadEmail}`)
    return findContactByEmail(leadEmail)
  }
  const details = item?.details
  if (!details?.Contacts?.id) return null
  return {
    contactId: details.Contacts.id,
    contactName: details.Contacts.name,
    accountId: details.Accounts?.id ?? '',
    accountName: details.Accounts?.name,
  }
}

const LVL2_FIELD_ID = '1321968000000748250'

export async function findLeadByEmail(email: string): Promise<string | null> {
  const token = await getAccessToken()
  const res = await fetch(
    `${BASE_URL}/Leads/search?criteria=(Email:equals:${encodeURIComponent(email)})&fields=id`,
    { headers: { Authorization: `Zoho-oauthtoken ${token}` }, cache: 'no-store' }
  )
  const data = await res.json() as { data?: { id: string }[] }
  return data.data?.[0]?.id ?? null
}

export async function addTagsToLead(leadId: string, tags: string[]): Promise<void> {
  const token = await getAccessToken()
  const tagNames = tags.map(t => encodeURIComponent(t)).join(',')
  await fetch(`${BASE_URL}/Leads/actions/add_tags?ids=${leadId}&tag_names=${tagNames}&over_write=false`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  })
}

function scoreLeadForDashboard(lead: Record<string, unknown>): number {
  const desig  = String(lead.Designation  ?? '').toLowerCase()
  const status = String(lead.Lead_Status  ?? '').toLowerCase()
  const source = String(lead.Lvl_1_Source ?? '').toLowerCase()
  const hasCo  = !!(lead.Company || lead.Company_Name)

  // Authority (0–13)
  let authority = 2
  if (/\b(cto|ceo|coo|cpo|vp|svp|evp|president|founder|director)\b/.test(desig)) authority = 13
  else if (/\b(head|principal|senior|sr\.?\s)\b/.test(desig)) authority = 9
  else if (/\b(manager|lead|tech\slead)\b/.test(desig)) authority = 7
  else if (/\b(engineer|developer|qa|sdet|tester|analyst)\b/.test(desig)) authority = 5

  // Need (0–20)
  let need = 5
  if (/\b(qa|quality|test|sdet|automation|qe)\b/.test(desig)) need = 20
  else if (/\b(l&d|learning|training|talent|enablement)\b/.test(desig)) need = 18
  else if (/\b(engineer|developer|software|tech)\b/.test(desig)) need = 12

  // Budget proxy (0–11)
  let budget = hasCo ? 6 : 2
  if (/\b(vp|director|head|cto|ceo)\b/.test(desig) && hasCo) budget = 11
  else if (/\b(manager|senior|lead)\b/.test(desig) && hasCo) budget = 8

  // Timeline (0–8)
  let timeline = 3
  if (status === 'contacted') timeline = 8
  else if (status === 'attempted to contact') timeline = 5

  // Fit (0–7)
  const fit = hasCo ? 7 : 2

  // Engagement from source (0–20)
  let engagement = 3
  if (/event|webinar|conference|summit|meetup/.test(source)) engagement = 20
  else if (/community|internal/.test(source)) engagement = 15
  else if (/email/.test(source)) engagement = 10
  else if (/cold/.test(source)) engagement = 6

  return authority + need + budget + timeline + fit + engagement
}

export async function getLeadsByStatus(): Promise<LeadCounts> {
  try {
    const data = await zohoGet(
      '/Leads?fields=Lead_Status,Tag,Converted__s,Designation,Company,Company_Name,Lvl_1_Source&per_page=200'
    ) as { data?: Record<string, unknown>[] }
    const leads = (data.data ?? []).filter(l => !l.Converted__s)
    let hot = 0, warm = 0, cold = 0

    for (const lead of leads) {
      // Explicit tags take priority
      const tags = Array.isArray(lead.Tag)
        ? (lead.Tag as Record<string, unknown>[]).map(t => String(t.name ?? '').toLowerCase())
        : []
      if (tags.includes('hot'))  { hot++;  continue }
      if (tags.includes('warm')) { warm++; continue }
      if (tags.includes('cold')) { cold++; continue }

      // Score-based classification (max ~79 pts)
      const score = scoreLeadForDashboard(lead)
      if (score >= 60)      hot++
      else if (score >= 35) warm++
      else                  cold++
    }

    return { hot, warm, cold, total: leads.length }
  } catch {
    return { hot: 0, warm: 0, cold: 0, total: 0 }
  }
}

type PickListValue = { actual_value: string; sequence_number: number; display_value: string; colour_code: null; id?: string; reference_value: string }

async function fetchLvl2Field(token: string): Promise<PickListValue[]> {
  const res = await fetch(`${BASE_URL}/settings/fields?module=Leads`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
    cache: 'no-store',
  })
  const data = await res.json() as { fields?: ({ api_name: string; pick_list_values?: PickListValue[] })[] }
  const field = data.fields?.find(f => f.api_name === 'Lvl_2_Source')
  return field?.pick_list_values ?? []
}

export async function getLvl2SourceValues(): Promise<string[]> {
  const token = await getAccessToken()
  const values = await fetchLvl2Field(token)
  return values.filter(v => v.actual_value !== '-None-').map(v => v.actual_value)
}

export async function addLvl2SourceValue(value: string): Promise<void> {
  const token = await getAccessToken()
  const existing = await fetchLvl2Field(token)
  const body = {
    pick_list_values: [
      ...existing,
      {
        display_value: value,
        actual_value: value,
        reference_value: value,
        colour_code: null,
        sequence_number: existing.filter(v => v.actual_value !== '-None-').length + 1,
      },
    ],
  }
  const patchRes = await fetch(`${BASE_URL}/settings/fields/${LVL2_FIELD_ID}?module=Leads`, {
    method: 'PATCH',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await patchRes.json() as {
    status?: string; message?: string; code?: string
    fields?: { status?: string; message?: string; code?: string }[]
  }
  console.log('[addLvl2SourceValue] Zoho response:', JSON.stringify(result))
  if (!patchRes.ok || result.status === 'error') {
    throw new Error(result.message ?? result.code ?? `HTTP ${patchRes.status}: ${JSON.stringify(result)}`)
  }
  const fieldResult = result.fields?.[0]
  if (fieldResult && fieldResult.status === 'error') {
    throw new Error(fieldResult.message ?? fieldResult.code ?? JSON.stringify(fieldResult))
  }
}

export async function createDeal(payload: {
  accountId: string
  accountName: string
  contactName: string
  contactEmail: string
  contactPhone: string
  stage: string
  closingDate: string
  dateOfFirstContact: string
}): Promise<string> {
  const token = await getAccessToken()
  const res = await fetch(`${BASE_URL}/Deals`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: [{
        Deal_Name: payload.accountName,
        Stage: payload.stage,
        Pipeline: 'Internal Community Data',
        Closing_Date: payload.closingDate,
        Account: { id: payload.accountId },
        Company_Name: payload.accountName,
        Contact_Full_Name: payload.contactName,
        Contact_Email: payload.contactEmail,
        Contact_Phone_No: payload.contactPhone || undefined,
        Deal_Tag: 'Warm',
        Date_of_First_Contact: payload.dateOfFirstContact,
        Lvl_1_Source: 'Internal Community Data',
      }]
    }),
  })
  const data = await res.json() as { data?: { details?: { id: string }; status?: string; message?: string; code?: string }[]; status?: string; message?: string; code?: string }
  if (data.status === 'error') {
    throw new Error(`Zoho: ${data.message ?? JSON.stringify(data)}`)
  }
  const record = data.data?.[0]
  if (record && record.status === 'error') {
    throw new Error(`Zoho: ${record.message ?? JSON.stringify(record)}`)
  }
  return record?.details?.id ?? ''
}

// Fetch all Zoho call IDs in a date range (yyyy-mm-dd) using COQL.
// Returns at most 200 records per call — callers should page if needed.
export async function getZohoCallsInRange(since: string, until: string): Promise<{ id: string; date: string }[]> {
  const token = await getAccessToken()
  const results: { id: string; date: string }[] = []
  let page = 1
  while (page <= 50) {
    const res = await fetch(
      `${BASE_URL}/Calls?fields=id,Call_Start_Time&per_page=200&page=${page}&sort_by=id&sort_order=desc`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` }, cache: 'no-store' }
    )
    const data = await res.json() as { data?: Record<string, unknown>[]; info?: { more_records?: boolean } }
    const rows = data.data ?? []
    if (rows.length === 0) break
    for (const c of rows) {
      const rawTime = String(c.Call_Start_Time ?? '')
      const date = rawTime.slice(0, 10)
      if (date >= since && date <= until && c.id) {
        results.push({ id: String(c.id), date })
      }
    }
    if (!data.info?.more_records) break
    page++
  }
  return results
}

export async function findDealByName(dealName: string): Promise<boolean> {
  const token = await getAccessToken()
  const encoded = encodeURIComponent(dealName)
  const res = await fetch(`${BASE_URL}/Deals/search?criteria=(Deal_Name:equals:${encoded})&fields=id&per_page=1`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
    cache: 'no-store',
  })
  const data = await res.json() as { data?: unknown[]; status?: string }
  if (data.status === 'error') return false
  return (data.data?.length ?? 0) > 0
}

export async function createDealLight(dealName: string, stage: string, closingDate: string): Promise<string | null> {
  const token = await getAccessToken()
  const res = await fetch(`${BASE_URL}/Deals`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [{ Deal_Name: dealName, Stage: stage, Pipeline: 'Internal Community Data', Closing_Date: closingDate }] }),
  })
  const data = await res.json() as { data?: { details?: { id: string }; status?: string; message?: string }[] }
  const record = data.data?.[0]
  if (record?.status === 'error') throw new Error(`Zoho createDeal: ${record.message}`)
  return record?.details?.id ?? null
}

export async function updateDealStage(dealId: string, stage: string): Promise<void> {
  const token = await getAccessToken()
  await fetch(`${BASE_URL}/Deals/${dealId}`, {
    method: 'PUT',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [{ Stage: stage }] }),
    cache: 'no-store',
  })
}

export interface ZohoEvent {
  id: string
  subject: string
  startDateTime: string
  whoName: string
  whatName: string
  whatId: string
  description: string
}

export async function getZohoEvents(sinceDate?: string): Promise<ZohoEvent[]> {
  const results: ZohoEvent[] = []
  let page = 1
  while (true) {
    const data = await zohoGet(
      `/Events?fields=id,Subject,Start_DateTime,Who_Id,What_Id,Description&per_page=200&page=${page}`
    ) as { data?: Record<string, unknown>[]; info?: { more_records?: boolean } }
    for (const e of data.data ?? []) {
      const startDateTime = (e.Start_DateTime as string) ?? ''
      if (sinceDate && startDateTime < sinceDate) continue
      const whoId = e.Who_Id as { id?: string; name?: string } | null
      const whatId = e.What_Id as { id?: string; name?: string } | null
      results.push({
        id: e.id as string,
        subject: (e.Subject as string) ?? '',
        startDateTime,
        whoName: whoId?.name ?? '',
        whatName: whatId?.name ?? '',
        whatId: whatId?.id ?? '',
        description: (e.Description as string) ?? '',
      })
    }
    if (!data.info?.more_records) break
    page++
  }
  return results
}
