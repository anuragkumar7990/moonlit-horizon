import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')

  if (!code) {
    return new NextResponse('No code received from Zoho.', { status: 400 })
  }

  // Must exactly match whatever redirect URI is registered in the Zoho API Console for this
  // client. Defaults to localhost for local dev; set ZOHO_REDIRECT_URI in the deployed
  // environment (and register that URL in the Zoho API Console) before re-authing in production —
  // previously hardcoded to localhost, which silently failed if run against the deployed app.
  const redirectUri = process.env.ZOHO_REDIRECT_URI || 'http://localhost:3000/api/zoho-callback'
  const res = await fetch(
    `https://accounts.zoho.in/oauth/v2/token?code=${code}&client_id=${process.env.ZOHO_CLIENT_ID}&client_secret=${process.env.ZOHO_CLIENT_SECRET}&redirect_uri=${encodeURIComponent(redirectUri)}&grant_type=authorization_code`,
    { method: 'POST' }
  )
  const data = await res.json()

  if (!data.refresh_token) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px">
        <h2>❌ Token exchange failed</h2>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  // Immediately test the refresh token we just got
  const testParams = new URLSearchParams({
    refresh_token: data.refresh_token,
    client_id: process.env.ZOHO_CLIENT_ID!,
    client_secret: process.env.ZOHO_CLIENT_SECRET!,
    grant_type: 'refresh_token',
  })
  const testRes = await fetch(`https://accounts.zoho.in/oauth/v2/token?${testParams.toString()}`, { method: 'POST' })
  const testData = await testRes.json()
  const tokenWorks = !!testData.access_token

  return new NextResponse(
    `<html><body style="font-family:sans-serif;padding:40px;max-width:700px">
      <h2>✅ Zoho Refresh Token Generated!</h2>
      <p><strong>Immediate test: ${tokenWorks ? '✅ Token works!' : '❌ Token failed — ' + JSON.stringify(testData)}</strong></p>
      <p>Copy the value below and paste it as <code>ZOHO_REFRESH_TOKEN</code> in your <code>.env.local</code> file.</p>
      <div style="background:#f1f5f9;padding:16px;border-radius:8px;word-break:break-all;font-family:monospace;font-size:14px;margin:16px 0">
        ${data.refresh_token}
      </div>
      <p style="color:#64748b;font-size:14px">Full token response: <pre>${JSON.stringify(data, null, 2)}</pre></p>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}
