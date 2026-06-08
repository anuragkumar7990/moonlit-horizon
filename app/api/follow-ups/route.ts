import { NextResponse } from 'next/server'
import { getCalls } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export async function GET() {
  const calls = await getCalls()
  const followUps = calls
    .filter(c => c.followUpDate)
    .map(c => ({
      account:       c.account,
      contactName:   c.contactName,
      contactPhone:  c.contactPhone,
      followUpDate:  c.followUpDate,
      callDate:      c.date,
      outcome:       c.outcome,
      notes:         c.notes,
      sdr:           c.sdr,
      zohoCallId:    c.zohoCallId,
    }))
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate))
  return NextResponse.json({ followUps })
}
