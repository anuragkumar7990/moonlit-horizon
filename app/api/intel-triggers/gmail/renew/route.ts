import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

// Called weekly by Vercel Cron to renew the Gmail watch (expires every 7 days).
// Also callable manually: POST /api/intel-triggers/gmail/renew
// Cron config is in vercel.json: "0 2 * * 1" (Monday 2am UTC = 7:30am IST)

export async function POST() {
  const topic = process.env.GMAIL_WATCH_TOPIC
  if (!topic) {
    return NextResponse.json({ error: 'GMAIL_WATCH_TOPIC env var not set' }, { status: 500 })
  }

  try {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
    const gmail = google.gmail({ version: 'v1', auth: oauth2 })

    await gmail.users.stop({ userId: 'me' }).catch(() => {})

    const res = await gmail.users.watch({
      userId: 'me',
      requestBody: { topicName: topic.trim() },
    })

    const { historyId, expiration } = res.data
    const expiresAt = new Date(Number(expiration)).toISOString()

    console.log(`[gmail-renew] watch renewed. historyId=${historyId} expires=${expiresAt}`)
    return NextResponse.json({ ok: true, historyId, expiresAt })
  } catch (e: unknown) {
    const detail = (e as { response?: { data?: unknown } })?.response?.data ?? String(e)
    console.error('[gmail-renew]', JSON.stringify(detail))
    return NextResponse.json({ error: String(e), detail }, { status: 500 })
  }
}
