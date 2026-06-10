import { NextRequest, NextResponse } from 'next/server'
import { getMeetings, getSheets } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!

export async function PATCH(
  req: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  try {
    const { status } = await req.json() as { status: string }
    if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 })

    const meetings = await getMeetings()
    // meetings array is 0-indexed; sheet rows start at 2 (row 1 = headers)
    const idx = meetings.findIndex(m => m.meetingId === params.meetingId)
    if (idx === -1) return NextResponse.json({ error: 'meeting not found' }, { status: 404 })

    const sheetRow = idx + 2
    const sheets = getSheets()
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Meetings!I${sheetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[status]] },
    })

    return NextResponse.json({ ok: true, meetingId: params.meetingId, status })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
