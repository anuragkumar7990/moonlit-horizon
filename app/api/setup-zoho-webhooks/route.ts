import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BASE_URL = 'https://www.zohoapis.in/crm/v3'
const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://moonlit-horizon.vercel.app'
const SECRET   = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'

// Channel IDs — fixed so we can identify/replace them
const CHANNEL_CALL_LOGGED = 100101
const CHANNEL_AUTO_MEETING = 100102

async function getAccessToken(): Promise<string> {
  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
    client_id:     process.env.ZOHO_CLIENT_ID!,
    client_secret: process.env.ZOHO_CLIENT_SECRET!,
    grant_type:    'refresh_token',
  })
  const res  = await fetch(`https://accounts.zoho.in/oauth/v2/token?${params.toString()}`, { method: 'POST' })
  const data = await res.json() as { access_token?: string }
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`)
  return data.access_token
}

async function listChannels(token: string) {
  const res  = await fetch(`${BASE_URL}/actions/watch`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  })
  return res.json() as Promise<{ watch?: { channel_id: string; events?: string[]; notify_url: string }[]; code?: string; message?: string }>
}

async function registerChannel(token: string, channelId: number, events: string[], notifyUrl: string) {
  const expiry = new Date()
  expiry.setFullYear(expiry.getFullYear() + 1)
  const expiryStr = expiry.toISOString().replace('Z', '+00:00')

  const res  = await fetch(`${BASE_URL}/actions/watch`, {
    method:  'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      watch: [{
        channel_id:     channelId,
        events,
        channel_expiry: expiryStr,
        notify_url:     notifyUrl,
        token:          SECRET,
      }],
    }),
  })
  return res.json() as Promise<{ watch?: { code: string; status: string; details?: Record<string, unknown> }[] }>
}

export async function GET(req: NextRequest) {
  // Programmatic webhook registration via Zoho's Notifications API is broken for this org
  // (returns OAUTH_SCOPE_MISMATCH) — see MOONLIT_HORIZON_MASTER.md §23.1. Webhooks are
  // configured manually via two Zoho CRM Workflow Rules instead; this route is kept only
  // for reference and intentionally does nothing live so it can't be mistaken for a working
  // setup path by a future maintainer.
  return NextResponse.json({
    error: 'deprecated',
    message: 'This route is non-functional (Zoho returns OAUTH_SCOPE_MISMATCH). Webhooks are configured manually in Zoho CRM — see MOONLIT_HORIZON_MASTER.md §23.1.',
  }, { status: 501 })

  // eslint-disable-next-line no-unreachable
  const pwd = req.headers.get('x-dashboard-password') ?? req.nextUrl.searchParams.get('password')
  if (pwd !== SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const token    = await getAccessToken()
    const existing = await listChannels(token)
    const channels = existing.watch ?? []
    const existingIds = new Set(channels.map(c => String(c.channel_id)))

    const results: Record<string, unknown> = {
      existingChannels: channels.map(c => ({ id: c.channel_id, events: c.events, url: c.notify_url })),
    }

    // Channel 1: sync every logged call to Sheets
    if (!existingIds.has(String(CHANNEL_CALL_LOGGED))) {
      results.callLoggedChannel = await registerChannel(
        token,
        CHANNEL_CALL_LOGGED,
        ['Calls.create', 'Calls.edit'],
        `${APP_URL}/api/webhook/zoho-call-logged?secret=${SECRET}`,
      )
    } else {
      results.callLoggedChannel = 'already_registered'
    }

    // Channel 2: auto-book meeting when Call_Result = Meeting Scheduled
    if (!existingIds.has(String(CHANNEL_AUTO_MEETING))) {
      results.autoMeetingChannel = await registerChannel(
        token,
        CHANNEL_AUTO_MEETING,
        ['Calls.edit'],
        `${APP_URL}/api/webhook/zoho-call?secret=${SECRET}`,
      )
    } else {
      results.autoMeetingChannel = 'already_registered'
    }

    return NextResponse.json({ ok: true, ...results })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
