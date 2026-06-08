import { NextResponse } from 'next/server'
import { getDeals } from '@/lib/zoho'
import { getMeetings, getLostDeals } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
function nowIST() { return new Date(Date.now() + IST_OFFSET_MS) }

export async function GET() {
  try {
    const [allDeals, lostDeals, meetings] = await Promise.all([
      getDeals(),
      getLostDeals(),
      getMeetings(),
    ])

    const today = nowIST().toISOString().slice(0, 10)

    const active = allDeals
      .filter(d => d.stage !== 'Lost')
      .map(d => ({
        id: d.id,
        name: d.dealName,
        account: d.accountName,
        stage: d.stage,
        temperature: d.temperature ?? null,
        amount: d.amount,
        closingDate: d.closingDate,
      }))

    const upcoming = meetings
      .filter(m => m.status === 'Meeting Booked' && m.meetingTime >= today)
      .slice(0, 20)
      .map(m => ({
        date: m.meetingTime,
        contact: m.contactName,
        company: m.accountName,
        meetingType: m.meetingType,
        dealId: m.dealId ?? '',
      }))

    return NextResponse.json({ active, lost: lostDeals, upcoming })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
