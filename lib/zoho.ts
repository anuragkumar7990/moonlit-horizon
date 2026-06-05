import type { ZohoDeal, ZohoContact, ZohoAccount } from './types'

const BASE_URL = 'https://www.zohoapis.in/crm/v3'

async function getAccessToken(): Promise<string> {
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
  return data.access_token as string
}

async function zohoGet(path: string): Promise<unknown> {
  const token = await getAccessToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
    next: { revalidate: 60 },
  })
  return res.json()
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
  const data = await zohoGet('/Contacts?fields=First_Name,Last_Name,Email,Account_Name&per_page=200') as { data?: Record<string, unknown>[] }
  return (data.data ?? []).map((c) => ({
    id: String(c.id ?? ''),
    firstName: String(c.First_Name ?? ''),
    lastName: String(c.Last_Name ?? ''),
    email: String(c.Email ?? ''),
    accountName: typeof c.Account_Name === 'object' && c.Account_Name !== null ? String((c.Account_Name as Record<string, unknown>).name ?? '') : String(c.Account_Name ?? ''),
  }))
}

export async function getZohoAccounts(): Promise<ZohoAccount[]> {
  const data = await zohoGet('/Accounts?fields=Account_Name&per_page=200') as { data?: Record<string, unknown>[] }
  return (data.data ?? []).map((a) => ({
    id: String(a.id ?? ''),
    accountName: String(a.Account_Name ?? ''),
  }))
}

export async function createDeal(payload: {
  accountId: string
  contactId: string
  dealName: string
  stage: string
  closingDate: string
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
        Deal_Name: payload.dealName,
        Stage: payload.stage,
        Pipeline: 'Internal Community Data',
        Closing_Date: payload.closingDate,
        Account_Name: { id: payload.accountId },
        Contact_Name: { id: payload.contactId },
      }]
    }),
  })
  const data = await res.json() as { data?: { details?: { id: string }; status?: string; message?: string; code?: string }[]; status?: string; message?: string; code?: string }
  if (data.status === 'error' || data.code) {
    throw new Error(`Zoho: ${data.message ?? data.code ?? JSON.stringify(data)}`)
  }
  const record = data.data?.[0]
  if (record && (record.status === 'error' || record.code)) {
    throw new Error(`Zoho: ${record.message ?? record.code} | ${JSON.stringify(record)}`)
  }
  return record?.details?.id ?? ''
}
