import { NextResponse } from 'next/server'
import { getDeals } from '@/lib/zoho'
import { getMeetings, getLostDeals } from '@/lib/sheets'
import { getCalendarEvents } from '@/lib/booking'

export const dynamic = 'force-dynamic'

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
function nowIST() { return new Date(Date.now() + IST_OFFSET_MS) }

const JUNK_PATTERNS = ['untagged company', 'the test tribe', 'test']
const isJunk = (name: string) => JUNK_PATTERNS.some(p => name.toLowerCase().includes(p))

function extractAccountFromTitle(title: string): string {
  const parts = title.split('<>')
  if (parts.length < 2) return title
  const left = parts[0].trim()
  const right = parts[1].split('|')[0].trim()
  return left.toLowerCase().includes('the test tribe') ? right : left
}

const TTT_CAL_PATTERNS = ['test tribe', 'upskilling', 'training', 'l1', 'l2']
const SKIP_CAL_TITLES = ['corporate training - daily scrum call', 'daily debrief - corporate training', 'weekly business review']

export async function GET() {
  try {
    const today    = nowIST().toISOString().slice(0, 10)
    const in14days = new Date(Date.now() + IST_OFFSET_MS + 14 * 86400000).toISOString().slice(0, 10)

    const [allDeals, lostDeals, meetings, calEvents] = await Promise.all([
      getDeals(),
      getLostDeals(),
      getMeetings(),
      getCalendarEvents(today, in14days).catch(() => []),
    ])

    const active = allDeals
      .filter(d => d.stage !== 'Lost')
      .map(d => ({
        id:          d.id,
        name:        d.dealName,
        account:     d.accountName,
        stage:       d.stage,
        temperature: d.temperature ?? null,
        amount:      d.amount,
        closingDate: d.closingDate,
      }))

    // Sheets-based upcoming meetings
    const sheetsUpcoming = meetings
      .filter(m => m.status === 'Meeting Booked' && m.meetingTime >= today && !isJunk(m.accountName))
      .slice(0, 20)
      .map(m => ({
        date:        m.meetingTime,
        contact:     m.contactName,
        company:     m.accountName,
        meetingType: m.meetingType as string,
        dealId:      m.dealId ?? '',
        gMeetLink:   m.gMeetLink ?? '',
        source:      'sheets' as const,
      }))

    // Calendar-only upcoming (dedup by GMeet link)
    const sheetsGMeetLinks = new Set(sheetsUpcoming.map(m => m.gMeetLink).filter(Boolean))
    const calUpcoming = calEvents
      .filter(e => {
        const lower = e.title.toLowerCase()
        if (!TTT_CAL_PATTERNS.some(p => lower.includes(p))) return false
        if (SKIP_CAL_TITLES.some(s => lower.includes(s))) return false
        if (isJunk(extractAccountFromTitle(e.title))) return false
        if (e.gMeetLink && sheetsGMeetLinks.has(e.gMeetLink)) return false
        return true
      })
      .map(e => ({
        date:        e.startTime,
        contact:     '',
        company:     extractAccountFromTitle(e.title),
        meetingType: e.title.toLowerCase().includes('l2') || e.title.toLowerCase().includes('next steps') ? 'L2+' : 'L1',
        dealId:      '',
        gMeetLink:   e.gMeetLink ?? '',
        source:      'calendar' as const,
      }))

    const upcoming = [...sheetsUpcoming, ...calUpcoming]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 20)

    return NextResponse.json({ active, lost: lostDeals, upcoming })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
