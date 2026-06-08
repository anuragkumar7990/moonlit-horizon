import { NextRequest, NextResponse } from 'next/server'
import { processZohoCall } from '@/lib/zoho-call-processor'

export const dynamic = 'force-dynamic'

const WEBHOOK_SECRET = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'

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

// GET — manual re-process for a specific callId (debugging / one-off backfill)
// Usage: GET /api/webhook/zoho-call-logged?callId=<id>&secret=thetesttribe
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== WEBHOOK_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const callId = req.nextUrl.searchParams.get('callId')
  if (!callId) return NextResponse.json({ error: 'callId param required' }, { status: 400 })
  const result = await processZohoCall(callId)
  return NextResponse.json(result, { status: result.ok ? 200 : 404 })
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
  const result = await processZohoCall(callId)
  return NextResponse.json(result, { status: result.ok ? 200 : 404 })
}
