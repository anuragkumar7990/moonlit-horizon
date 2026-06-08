import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BASE_URL = 'https://www.zohoapis.in/crm/v3'
const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://moonlit-horizon.vercel.app'
const SECRET   = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'

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

async function listWorkflowRules(token: string) {
  const res  = await fetch(`${BASE_URL}/settings/automation/workflow_rules?module=Calls`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  })
  const data = await res.json() as { workflow_rules?: { id: string; name: string }[]; status?: string; message?: string }
  return data
}

async function createWorkflowRule(token: string, rule: Record<string, unknown>) {
  const res  = await fetch(`${BASE_URL}/settings/automation/workflow_rules`, {
    method:  'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ workflow_rules: [rule] }),
  })
  const data = await res.json() as { workflow_rules?: { code: string; status: string; details?: Record<string, unknown> }[] }
  return data
}

export async function GET(req: NextRequest) {
  const pwd = req.headers.get('x-dashboard-password') ?? req.nextUrl.searchParams.get('password')
  if (pwd !== SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const token = await getAccessToken()

    // List existing rules to check if already set up
    const existing = await listWorkflowRules(token)
    const existingNames = (existing.workflow_rules ?? []).map(r => r.name)

    const results: Record<string, unknown> = { existing: existingNames }

    // Webhook 1 — sync every new call to Sheets
    const callSyncName = 'MH: Sync Call to Sheets'
    if (!existingNames.includes(callSyncName)) {
      const r1 = await createWorkflowRule(token, {
        name:        callSyncName,
        description: 'Auto-sync every logged call to Moonlit Horizon Sheets',
        module:      { api_name: 'Calls' },
        trigger:     { fields: [{ api_name: 'Created_Time' }] },
        conditions:  [],
        actions:     [{
          type:       'webhook',
          parameters: {
            url:          `${APP_URL}/api/webhook/zoho-call-logged?secret=${SECRET}`,
            method:       'post',
            content_type: 'application/x-www-form-urlencoded',
            parameters:   [{ key: 'callId', value: '${zoho_id}' }],
          },
        }],
      })
      results.callSyncWebhook = r1
    } else {
      results.callSyncWebhook = 'already_exists'
    }

    // Webhook 2 — auto-book meeting when Call_Result = Meeting Scheduled
    const autoMeetingName = 'MH: Auto-Book Meeting on Call'
    if (!existingNames.includes(autoMeetingName)) {
      const r2 = await createWorkflowRule(token, {
        name:        autoMeetingName,
        description: 'Auto-book Google Meet + Zoho Deal when Call_Result set to Meeting Scheduled',
        module:      { api_name: 'Calls' },
        trigger:     { fields: [{ api_name: 'Call_Result' }] },
        conditions:  [{
          field: { api_name: 'Call_Result' },
          comparator: 'equals',
          value: 'Meeting Scheduled',
        }],
        actions:     [{
          type:       'webhook',
          parameters: {
            url:          `${APP_URL}/api/webhook/zoho-call?secret=${SECRET}`,
            method:       'post',
            content_type: 'application/x-www-form-urlencoded',
            parameters:   [{ key: 'callId', value: '${zoho_id}' }],
          },
        }],
      })
      results.autoMeetingWebhook = r2
    } else {
      results.autoMeetingWebhook = 'already_exists'
    }

    return NextResponse.json({ ok: true, ...results })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
