import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export interface LumaEvent {
  id: string
  name: string
  startAt: string
  endAt: string
  coverUrl?: string
  url: string
  guestCount: number
  status: string
  location?: string
  markedRelevant?: boolean
}

export async function GET() {
  const apiKey = process.env.LUMA_API_KEY
  const calendarId = process.env.LUMA_CALENDAR_API_ID

  if (!apiKey || !calendarId) {
    return NextResponse.json({
      configured: false,
      events: [],
      message: 'Set LUMA_API_KEY and LUMA_CALENDAR_API_ID in environment variables.',
    })
  }

  try {
    const url = `https://api.lu.ma/public/v1/calendar/list-events?calendar_api_id=${calendarId}&pagination_limit=50`
    const res = await fetch(url, {
      headers: { 'x-luma-api-key': apiKey },
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ configured: true, events: [], error: `Luma API error ${res.status}: ${text}` })
    }

    const data = await res.json() as {
      entries?: Array<{
        event?: {
          api_id: string
          name: string
          start_at: string
          end_at: string
          cover_url?: string
          url: string
          geo_address_info?: { city_state?: string }
        }
        ticket_count?: number
      }>
    }

    const events: LumaEvent[] = (data.entries ?? []).map(e => ({
      id: e.event?.api_id ?? '',
      name: e.event?.name ?? '',
      startAt: e.event?.start_at ?? '',
      endAt: e.event?.end_at ?? '',
      coverUrl: e.event?.cover_url,
      url: e.event?.url ?? '',
      guestCount: e.ticket_count ?? 0,
      status: new Date(e.event?.end_at ?? '') < new Date() ? 'Past' : 'Upcoming',
      location: e.event?.geo_address_info?.city_state,
    }))

    return NextResponse.json({ configured: true, events, fetchedAt: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ configured: true, events: [], error: String(err) }, { status: 500 })
  }
}
