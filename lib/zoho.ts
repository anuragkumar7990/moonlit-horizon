import type { ZohoDeal, ZohoContact, ZohoAccount } from './types'

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
  const data = await zohoGet('/Deals?fields=Deal_Name,Stage,Amount,Closing_Date,Account_Name,Contact_Name&per_page=200') as { data?: Record<string, unknown>[] }
  return (data.data ?? []).map((d) => ({
    id: String(d.id ?? ''),
    dealName: String(d.Deal_Name ?? ''),
    stage: String(d.Stage ?? ''),
    amount: String(d.Amount ?? ''),
    closingDate: String(d.Closing_Date ?? ''),
    accountName: typeof d.Account_Name === 'object' && d.Account_Name !== null ? String((d.Account_Name as Record<string, unknown>).name ?? '') : String(d.Account_Name ?? ''),
    contactName: typeof d.Contact_Name === 'object' && d.Contact_Name !== null ? String((d.Contact_Name as Record<string, unknown>).name ?? '') : String(d.Contact_Name ?? ''),
  }))
}

export async function getDealByAccount(accountName: string): Promise<ZohoDeal | null> {
  const all = await getDeals()
  return all.find(d => d.accountName.toLowerCase() === accountName.toLowerCase()) ?? null
}

export async function getContacts(): Promise<ZohoContact[]> {
  const data = await zohoGet('/Contacts?fields=First_Name,Last_Name,Email,Phone,Mobile,Account_Contact&per_page=200') as { data?: Record<string, unknown>[] }
  return (data.data ?? []).map((c) => {
    const acct = typeof c.Account_Contact === 'object' && c.Account_Contact !== null ? c.Account_Contact as Record<string, unknown> : null
    return {
      id: String(c.id ?? ''),
      firstName: String(c.First_Name ?? ''),
      lastName: String(c.Last_Name ?? ''),
      email: String(c.Email ?? ''),
      phone: String(c.Phone ?? c.Mobile ?? ''),
      accountId: String(acct?.id ?? ''),
      accountName: String(acct?.name ?? ''),
    }
  })
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

export async function getLeads(): Promise<{ id: string; firstName: string; lastName: string; email: string; company: string }[]> {
  const data = await zohoGet('/Leads?fields=First_Name,Last_Name,Email,Company,Company_Name,Converted__s&per_page=200') as { data?: Record<string, unknown>[] }
  return (data.data ?? [])
    .filter(l => !l.Converted__s)
    .map(l => ({
      id: String(l.id ?? ''),
      firstName: String(l.First_Name ?? ''),
      lastName: String(l.Last_Name ?? ''),
      email: String(l.Email ?? ''),
      company: String(l.Company ?? l.Company_Name ?? ''),
    }))
}

export async function getLeadById(id: string): Promise<{ id: string; firstName: string; lastName: string; email: string; phone: string; company: string } | null> {
  try {
    const data = await zohoGet(`/Leads/${id}?fields=First_Name,Last_Name,Email,Phone,Mobile,Company,Company_Name`) as { data?: Record<string, unknown>[] }
    const l = data.data?.[0]
    if (!l) return null
    return {
      id: String(l.id ?? ''),
      firstName: String(l.First_Name ?? ''),
      lastName: String(l.Last_Name ?? ''),
      email: String(l.Email ?? ''),
      phone: String(l.Phone ?? l.Mobile ?? ''),
      company: String(l.Company ?? l.Company_Name ?? ''),
    }
  } catch { return null }
}

export async function getContactById(id: string): Promise<ZohoContact | null> {
  const data = await zohoGet(`/Contacts/${id}?fields=First_Name,Last_Name,Email,Phone,Mobile,Account_Contact`) as { data?: Record<string, unknown>[] }
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
  }
}

export async function getCallById(id: string): Promise<{
  id: string
  callResult: string
  proposedMeetingTime: string
  seModule: string
  whoId: { id: string; module: string; name: string } | null
  whatId: { id: string; module: string; name: string } | null
} | null> {
  const data = await zohoGet(`/Calls/${id}`) as { data?: Record<string, unknown>[] }
  const c = data.data?.[0]
  if (!c) return null
  const whoId = c.Who_Id && typeof c.Who_Id === 'object'
    ? c.Who_Id as { id: string; module: string; name: string }
    : null
  const whatId = c.What_Id && typeof c.What_Id === 'object'
    ? c.What_Id as { id: string; module: string; name: string }
    : null
  return {
    id: String(c.id ?? ''),
    callResult: String(c.Call_Result ?? ''),
    proposedMeetingTime: String(c.Proposed_Meeting_Time ?? ''),
    seModule: String(c.$se_module ?? ''),
    whoId,
    whatId,
  }
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

export async function convertLead(leadId: string): Promise<{
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
  const details = data.data?.[0]?.details
  if (!details?.Contacts?.id) return null
  return {
    contactId: details.Contacts.id,
    contactName: details.Contacts.name,
    accountId: details.Accounts?.id ?? '',
    accountName: details.Accounts?.name,
  }
}

const LVL2_FIELD_ID = '1321968000000748250'

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
  const putRes = await fetch(`${BASE_URL}/settings/fields?module=Leads`, {
    method: 'PUT',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: [{
        id: LVL2_FIELD_ID,
        pick_list_values: [
          ...existing,
          { display_value: value, actual_value: value, sequence_number: existing.length + 1 },
        ],
      }],
    }),
  })
  const result = await putRes.json() as { status?: string; message?: string }
  if (result.status === 'error') throw new Error(result.message ?? JSON.stringify(result))
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
