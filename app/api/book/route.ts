import { NextRequest, NextResponse } from 'next/server'
import { bookMeeting } from '@/lib/booking'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      accountId: string
      accountName: string
      contactId: string
      contactName: string
      contactEmail: string
      contactPhone?: string
      meetingTime: string
      meetingType: 'L1' | 'L2+'
    }

    const { accountId, accountName, contactName, contactEmail, contactPhone, meetingTime, meetingType } = body

    const result = await bookMeeting({
      accountId,
      accountName,
      contactName,
      contactEmail,
      contactPhone,
      meetingTime,
      meetingType,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[/api/book]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
