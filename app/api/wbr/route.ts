import { NextRequest, NextResponse } from 'next/server'
import { getCalls, getMeetings, getSheets } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
function nowIST() { return new Date(Date.now() + IST_OFFSET_MS) }
function todayIST() { return nowIST().toISOString().slice(0, 10) }

async function ensureWBRTab(sheets: ReturnType<typeof getSheets>) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const exists = meta.data.sheets?.some(s => (s.properties?.title ?? '') === 'WBR Notes')
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'WBR Notes' } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "'WBR Notes'!A1",
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['SessionNumber', 'Date', 'Notes', 'ActionItems', 'MeetingHappened']] },
    })
  }
}

async function readWBRSessions(sheets: ReturnType<typeof getSheets>) {
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "'WBR Notes'!A:E" })
    return (res.data.values ?? []).slice(1).filter(r => r.length > 0).map((r, i) => ({
      rowIndex: i + 2,
      sessionNumber: Number(r[0]) || (i + 1),
      date: String(r[1] ?? ''),
      notes: String(r[2] ?? ''),
      actionItems: String(r[3] ?? ''),
      meetingHappened: String(r[4] ?? '') !== 'No',
    }))
  } catch { return [] }
}

// Generate upcoming Friday dates starting from a given date, up to N sessions
function upcomingFridays(from: Date, count: number): string[] {
  const dates: string[] = []
  const d = new Date(from)
  // Move to next Friday
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7))
  for (let i = 0; i < count; i++) {
    dates.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 7)
  }
  return dates
}

export async function GET() {
  try {
    const sheets = getSheets()
    await ensureWBRTab(sheets)

    const today = todayIST()
    const [sessions, calls, meetings] = await Promise.all([
      readWBRSessions(sheets),
      getCalls(),
      getMeetings(),
    ])

    // Build upcoming WBR session list: existing sessions + auto-generate future ones
    const highestNum = sessions.length > 0 ? Math.max(...sessions.map(s => s.sessionNumber)) : 0
    const lastDate = sessions.length > 0 ? sessions[sessions.length - 1].date : today

    // Fill next 4 upcoming sessions not yet in sheet
    const futureBaseDate = new Date(lastDate || today)
    const futureSlots = upcomingFridays(futureBaseDate, 4)
    const allSessions = [
      ...sessions,
      ...futureSlots.map((date, i) => ({
        rowIndex: -1,
        sessionNumber: highestNum + i + 1,
        date,
        notes: '',
        actionItems: '',
        meetingHappened: true,
      })),
    ]

    // Weekly stats for suggested items
    const oneWeekAgo = new Date(Date.now() + IST_OFFSET_MS - 7 * 86400000).toISOString().slice(0, 10)
    const weekCalls = calls.filter(c => c.date >= oneWeekAgo && c.date <= today)
    const weekMtgs = meetings.filter(m => m.meetingTime?.slice(0, 10) >= oneWeekAgo)

    const suggestedItems = [
      `${weekCalls.length} calls this week`,
      `${weekMtgs.filter(m => m.status === 'Conducted').length} meetings conducted this week`,
      `${weekMtgs.filter(m => m.status === 'Meeting Booked').length} meetings still booked`,
    ]

    return NextResponse.json({
      today,
      sessions: allSessions.sort((a, b) => b.sessionNumber - a.sessionNumber),
      suggestedItems,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const sheets = getSheets()
  await ensureWBRTab(sheets)

  const body = await req.json() as {
    sessionNumber: number
    date?: string
    notes?: string
    actionItems?: string
    meetingHappened?: boolean
    rowIndex?: number
    updateDateOnly?: boolean
  }

  if (body.rowIndex && body.rowIndex > 0) {
    if (body.updateDateOnly) {
      // Only update the Date column (col B)
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'WBR Notes'!B${body.rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[body.date ?? '']] },
      })
    } else {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'WBR Notes'!B${body.rowIndex}:E${body.rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[body.date ?? '', body.notes ?? '', body.actionItems ?? '', body.meetingHappened !== false ? 'Yes' : 'No']] },
      })
    }
  } else {
    // Append new session row
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "'WBR Notes'!A:E",
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[body.sessionNumber, body.date ?? '', body.notes ?? '', body.actionItems ?? '', body.meetingHappened !== false ? 'Yes' : 'No']],
      },
    })
  }

  return NextResponse.json({ ok: true })
}
