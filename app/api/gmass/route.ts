import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const apiKey = process.env.GMASS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GMASS_API_KEY not configured' }, { status: 503 })
  }

  try {
    const res = await fetch(`https://api.gmass.co/api/campaigns?apiKey=${apiKey}`, {
      cache: 'no-store',
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[/api/gmass] GMass API error:', res.status, body)
      return NextResponse.json({ error: `GMass API returned ${res.status}` }, { status: 502 })
    }
    const data = await res.json()
    // GMass may return array directly or wrapped — normalise to array
    const campaigns = Array.isArray(data) ? data : (data.campaigns ?? data.data ?? [])
    return NextResponse.json({ campaigns })
  } catch (err) {
    console.error('[/api/gmass]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
