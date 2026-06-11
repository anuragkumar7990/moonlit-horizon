import { NextResponse } from 'next/server'

export async function GET() {
  // Step 1: try to get an access token
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN ?? ''
  const clientId = process.env.ZOHO_CLIENT_ID ?? ''
  const clientSecret = process.env.ZOHO_CLIENT_SECRET ?? ''

  // Show what we have (masked) before even calling Zoho
  const diagnostics = {
    refreshToken_length: refreshToken.length,
    refreshToken_start: refreshToken.slice(0, 8),
    refreshToken_end: refreshToken.slice(-4),
    clientId_length: clientId.length,
    clientId_start: clientId.slice(0, 8),
    clientSecret_length: clientSecret.length,
  }

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  })
  const tokenRes = await fetch(`https://accounts.zoho.in/oauth/v2/token?${params.toString()}`, {
    method: 'POST',
  })
  const tokenData = await tokenRes.json()

  if (!tokenData.access_token) {
    return NextResponse.json({ step: 'token_failed', tokenData, diagnostics })
  }

  // Step 2: try to fetch accounts
  const accountsRes = await fetch('https://www.zohoapis.in/crm/v3/Accounts?fields=Account_Name&per_page=5', {
    headers: { Authorization: `Zoho-oauthtoken ${tokenData.access_token}` }
  })
  const accountsData = await accountsRes.json()

  // Step 3: try to fetch contacts
  const contactsRes = await fetch('https://www.zohoapis.in/crm/v3/Contacts?fields=First_Name,Last_Name,Email,Account_Name&per_page=5', {
    headers: { Authorization: `Zoho-oauthtoken ${tokenData.access_token}` }
  })
  const contactsData = await contactsRes.json()

  // Step 4: raw deal to see all fields
  const dealRes = await fetch('https://www.zohoapis.in/crm/v2/Deals/1321968000001023010', {
    headers: { Authorization: `Zoho-oauthtoken ${tokenData.access_token}` }
  })
  const dealData = await dealRes.json()

  return NextResponse.json({ step: 'success', tokenData: { access_token: '***' }, accountsData, contactsData, dealData })
}
