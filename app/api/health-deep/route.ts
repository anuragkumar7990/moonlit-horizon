import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

interface CheckResult {
  ok: boolean | null   // null = not configured / cannot test
  detail: string
  latencyMs?: number
  warning?: string
}

interface HealthReport {
  ok: boolean
  checkedAt: string
  integrations: {
    googleSheets: CheckResult
    zoho: CheckResult
    luma: CheckResult
    circleback: CheckResult
    trainerSheets: CheckResult
    discordBot: CheckResult
  }
  dataFreshness: {
    lastCallDate: string | null
    callsThisMonth: number
    meetingsThisMonth: number
    prospectCount: number
    daysStale: number | null
  }
}

// ── Google Sheets ─────────────────────────────────────────────────────────────

async function checkGoogleSheets(): Promise<CheckResult> {
  const t0 = Date.now()
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
      return { ok: false, detail: 'Missing env vars: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN' }
    }
    if (!process.env.SHEETS_SPREADSHEET_ID) {
      return { ok: false, detail: 'Missing env var: SHEETS_SPREADSHEET_ID' }
    }

    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    )
    oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })

    // Force a token refresh to confirm credentials are valid
    const { credentials } = await oauth2.refreshAccessToken()
    if (!credentials.access_token) {
      return { ok: false, detail: 'Token refresh succeeded but returned no access_token — credentials may be revoked' }
    }

    const sheets = google.sheets({ version: 'v4', auth: oauth2 })

    // Fetch sheet names and row counts from the main spreadsheet
    const meta = await sheets.spreadsheets.get({ spreadsheetId: process.env.SHEETS_SPREADSHEET_ID })
    const sheetList = (meta.data.sheets ?? []).map(s => s.properties?.title ?? '')

    // Count rows in Calls, Meetings, Prospects tabs
    const counts: Record<string, number> = {}
    for (const tab of ['Calls', 'Meetings', 'Prospects'] as const) {
      if (!sheetList.includes(tab)) { counts[tab] = 0; continue }
      try {
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId: process.env.SHEETS_SPREADSHEET_ID!,
          range: `${tab}!A:A`,
        })
        counts[tab] = Math.max(0, (res.data.values?.length ?? 1) - 1) // subtract header
      } catch {
        counts[tab] = -1
      }
    }

    const parts = Object.entries(counts).map(([k, v]) => v === -1 ? `${k}: read error` : `${k}: ${v} rows`)
    const latencyMs = Date.now() - t0

    return {
      ok: true,
      detail: `Auth valid. ${parts.join(', ')}`,
      latencyMs,
    }
  } catch (err) {
    const msg = String(err)
    if (msg.includes('invalid_grant') || msg.includes('Token has been expired')) {
      return { ok: false, detail: 'Google OAuth refresh token has expired — re-authorise in Google Cloud Console', latencyMs: Date.now() - t0 }
    }
    return { ok: false, detail: msg.slice(0, 300), latencyMs: Date.now() - t0 }
  }
}

// ── Zoho CRM ──────────────────────────────────────────────────────────────────

async function checkZoho(): Promise<CheckResult> {
  const t0 = Date.now()
  try {
    if (!process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET || !process.env.ZOHO_REFRESH_TOKEN) {
      return { ok: false, detail: 'Missing env vars: ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REFRESH_TOKEN' }
    }

    // Test token refresh
    const params = new URLSearchParams({
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      client_id:     process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type:    'refresh_token',
    })
    const tokenRes = await fetch(`https://accounts.zoho.in/oauth/v2/token?${params.toString()}`, {
      method: 'POST',
    })
    const tokenData = await tokenRes.json() as { access_token?: string; error?: string }
    if (!tokenData.access_token) {
      return {
        ok: false,
        detail: `Token refresh failed: ${tokenData.error ?? JSON.stringify(tokenData).slice(0, 200)}`,
        latencyMs: Date.now() - t0,
      }
    }

    // Fetch lead + deal counts (lightweight)
    const BASE = 'https://www.zohoapis.in/crm/v3'
    const headers = { Authorization: `Zoho-oauthtoken ${tokenData.access_token}` }

    const [leadsRes, dealsRes] = await Promise.all([
      fetch(`${BASE}/Leads?fields=id,Lead_Status,Converted__s&per_page=1`, { headers, cache: 'no-store' }),
      fetch(`${BASE}/Deals?fields=id,Stage&per_page=1`, { headers, cache: 'no-store' }),
    ])

    const leadsData = await leadsRes.json() as { info?: { count?: number }; data?: unknown[]; code?: string; message?: string }
    const dealsData = await dealsRes.json() as { info?: { count?: number }; data?: unknown[]; code?: string; message?: string }

    if (leadsData.code === 'AUTHENTICATION_FAILURE' || dealsData.code === 'AUTHENTICATION_FAILURE') {
      return { ok: false, detail: 'Token refreshed but API calls rejected — check API scopes in Zoho', latencyMs: Date.now() - t0 }
    }

    const leadCount = leadsData.info?.count ?? leadsData.data?.length ?? '?'
    const dealCount = dealsData.info?.count ?? dealsData.data?.length ?? '?'

    return {
      ok: true,
      detail: `Token refreshed. ~${leadCount} leads, ~${dealCount} deals visible`,
      latencyMs: Date.now() - t0,
    }
  } catch (err) {
    return { ok: false, detail: String(err).slice(0, 300), latencyMs: Date.now() - t0 }
  }
}

// ── Luma ──────────────────────────────────────────────────────────────────────

async function checkLuma(): Promise<CheckResult> {
  const t0 = Date.now()
  const apiKey = process.env.LUMA_API_KEY
  const calId  = process.env.LUMA_CALENDAR_API_ID

  if (!apiKey || !calId) {
    return {
      ok: null,
      detail: `Not configured — missing: ${[!apiKey && 'LUMA_API_KEY', !calId && 'LUMA_CALENDAR_API_ID'].filter(Boolean).join(', ')}`,
    }
  }

  try {
    const res = await fetch(
      `https://api.lu.ma/public/v1/calendar/list-events?calendar_api_id=${calId}&pagination_limit=1`,
      { headers: { 'x-luma-api-key': apiKey }, cache: 'no-store' }
    )
    const data = await res.json() as { entries?: unknown[]; error?: string; message?: string }
    if (!res.ok || data.error) {
      return { ok: false, detail: `API error (HTTP ${res.status}): ${data.error ?? data.message ?? ''}`, latencyMs: Date.now() - t0 }
    }
    return { ok: true, detail: `Luma API responding. Calendar connected.`, latencyMs: Date.now() - t0 }
  } catch (err) {
    return { ok: false, detail: String(err).slice(0, 200), latencyMs: Date.now() - t0 }
  }
}

// ── Circleback ────────────────────────────────────────────────────────────────

function checkCircleback(): CheckResult {
  const hasSecret = !!process.env.CIRCLEBACK_WEBHOOK_SECRET
  return {
    ok: null,
    detail: `Webhook-driven (push-only) — cannot call outbound. Webhook secret: ${hasSecret ? 'configured ✓' : 'not set — webhooks accepted unsigned'}`,
    warning: hasSecret ? undefined : 'Set CIRCLEBACK_WEBHOOK_SECRET in Vercel to verify webhook authenticity',
  }
}

// ── Trainer Sheets ────────────────────────────────────────────────────────────

async function checkTrainerSheets(): Promise<CheckResult> {
  const t0 = Date.now()
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
      return { ok: false, detail: 'Google credentials missing — cannot check trainer sheets' }
    }

    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    )
    oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })

    const sheets = google.sheets({ version: 'v4', auth: oauth2 })

    const SHEET_A = '1Xol3kb_5GDxS-Su-fAs1tIvTSLfGahNXWHv0MKUOY9I' // Form responses
    const SHEET_B = '1R8FqcifveekYZsaS3taHARaQAo3CjZ0FqdHnNOcZg2U' // Roster

    const [resA, resB] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_A, range: 'A:A' }),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_B, range: 'A:A' }),
    ])

    const appRows = Math.max(0, (resA.data.values?.length ?? 1) - 1)
    const rosterRows = (resB.data.values?.length ?? 0)

    return {
      ok: appRows > 0,
      detail: `Applications sheet: ${appRows} submissions. Roster/pricing sheet: ${rosterRows} rows total.`,
      latencyMs: Date.now() - t0,
      warning: appRows === 0 ? 'No trainer applications found in Sheet A' : undefined,
    }
  } catch (err) {
    return { ok: false, detail: String(err).slice(0, 200), latencyMs: Date.now() - t0 }
  }
}

// ── Data Freshness ────────────────────────────────────────────────────────────

async function checkDataFreshness() {
  const empty = { lastCallDate: null, callsThisMonth: 0, meetingsThisMonth: 0, prospectCount: 0, daysStale: null }
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.SHEETS_SPREADSHEET_ID) return empty

    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    )
    oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
    const sheets = google.sheets({ version: 'v4', auth: oauth2 })

    const now = new Date()
    const monthPrefix = now.toISOString().slice(0, 7) // "2026-06"

    const [callsRes, meetingsRes, prospectsRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: process.env.SHEETS_SPREADSHEET_ID!, range: 'Calls!A:A' }).catch(() => null),
      sheets.spreadsheets.values.get({ spreadsheetId: process.env.SHEETS_SPREADSHEET_ID!, range: 'Meetings!A:E' }).catch(() => null),
      sheets.spreadsheets.values.get({ spreadsheetId: process.env.SHEETS_SPREADSHEET_ID!, range: 'Prospects!A:A' }).catch(() => null),
    ])

    // Last call date and this-month count
    const callDates = (callsRes?.data.values ?? []).slice(1)
      .map(r => String(r[0] ?? ''))
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort()
    const lastCallDate = callDates[callDates.length - 1] ?? null
    const callsThisMonth = callDates.filter(d => d.startsWith(monthPrefix)).length

    // Meetings this month (col E = meetingTime)
    const meetingsThisMonth = (meetingsRes?.data.values ?? []).slice(1)
      .filter(r => String(r[4] ?? '').startsWith(monthPrefix)).length

    // Prospect count
    const prospectCount = Math.max(0, (prospectsRes?.data.values?.length ?? 1) - 1)

    // Days stale
    let daysStale: number | null = null
    if (lastCallDate) {
      const last = new Date(lastCallDate)
      daysStale = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
    }

    return { lastCallDate, callsThisMonth, meetingsThisMonth, prospectCount, daysStale }
  } catch {
    return empty
  }
}

// ── Discord Bot ───────────────────────────────────────────────────────────────

function checkDiscordBot(): CheckResult {
  const hasToken = !!process.env.DISCORD_BOT_TOKEN
  return {
    ok: null,
    detail: `VPS-hosted process — not directly testable from Vercel. Bot token: ${hasToken ? 'configured ✓' : 'not found in Vercel env'}`,
    warning: 'To monitor the VPS bot process, check the #health-checker channel — the bot posts to Discord; silence means it may be down.',
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET() {
  const [googleSheets, zoho, luma, trainerSheets, freshness] = await Promise.all([
    checkGoogleSheets(),
    checkZoho(),
    checkLuma(),
    checkTrainerSheets(),
    checkDataFreshness(),
  ])

  const circleback  = checkCircleback()
  const discordBot  = checkDiscordBot()

  const allChecks = [googleSheets, zoho, trainerSheets]
  const anyFailed = allChecks.some(c => c.ok === false)

  // Stale data warning (>3 days since last call)
  if (freshness.daysStale !== null && freshness.daysStale > 3) {
    googleSheets.warning = (googleSheets.warning ?? '') +
      ` Data may be stale — last call logged ${freshness.daysStale} days ago.`
  }

  const report: HealthReport = {
    ok: !anyFailed,
    checkedAt: new Date().toISOString(),
    integrations: { googleSheets, zoho, luma, circleback, trainerSheets, discordBot },
    dataFreshness: freshness,
  }

  return NextResponse.json(report, { status: anyFailed ? 503 : 200 })
}
