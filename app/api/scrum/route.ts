import { NextRequest, NextResponse } from 'next/server'
import { getMeetings, getCalls, getSheets } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
function nowIST() { return new Date(Date.now() + IST_OFFSET_MS) }
function todayIST() { return nowIST().toISOString().slice(0, 10) }

async function ensureScrumTab(sheets: ReturnType<typeof getSheets>) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const exists = meta.data.sheets?.some(s => (s.properties?.title ?? '') === 'Scrum Notes')
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Scrum Notes' } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "'Scrum Notes'!A1",
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['Date', 'SlotTime', 'Notes', 'ActionItems', 'MeetingHappened']] },
    })
  }
}

async function readScrumNotes(sheets: ReturnType<typeof getSheets>) {
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "'Scrum Notes'!A:E" })
    return (res.data.values ?? []).slice(1).filter(r => r.length > 0).map((r, i) => ({
      rowIndex: i + 2,
      date: String(r[0] ?? ''),
      slotTime: String(r[1] ?? ''),
      notes: String(r[2] ?? ''),
      actionItems: String(r[3] ?? ''),
      meetingHappened: String(r[4] ?? '') !== 'No',
    }))
  } catch { return [] }
}

export async function GET() {
  try {
    const sheets = getSheets()
    await ensureScrumTab(sheets)

    const today = todayIST()
    const [meetings, calls, scrumNotes] = await Promise.all([
      getMeetings(),
      getCalls(),
      readScrumNotes(sheets),
    ])

    const todaysCalls = calls.filter(c => c.date === today)
    const dialled = todaysCalls.length
    const connected = todaysCalls.filter(c => !['No Answer', 'Voicemail', 'Not Reachable', 'RNR', 'Busy', 'Unanswered'].some(s => c.outcome?.toLowerCase().includes(s.toLowerCase()))).length
    const meetingsBooked = todaysCalls.filter(c => c.outcome?.toLowerCase().includes('meeting')).length

    const JUNK = ['untagged company', 'the test tribe', 'test']
    const isJunk = (name: string) => JUNK.some(p => name.toLowerCase().includes(p))

    const todayMtgs = meetings.filter(m => m.meetingTime?.slice(0, 10) === today && !isJunk(m.accountName))
    const tomorrowIST = new Date(Date.now() + IST_OFFSET_MS + 86400000).toISOString().slice(0, 10)
    const tomorrowMtgs = meetings.filter(m => m.meetingTime?.slice(0, 10) === tomorrowIST && !isJunk(m.accountName))

    const suggestedItems: string[] = []
    if (dialled > 0) suggestedItems.push(`${dialled} calls dialled today, ${connected} connected, ${meetingsBooked} meetings booked`)
    if (todayMtgs.length > 0) suggestedItems.push(`${todayMtgs.length} meetings scheduled for today: ${todayMtgs.map(m => m.accountName).join(', ')}`)
    if (tomorrowMtgs.length > 0) suggestedItems.push(`${tomorrowMtgs.length} meetings tomorrow: ${tomorrowMtgs.map(m => m.accountName).join(', ')}`)
    if (suggestedItems.length === 0) suggestedItems.push('No calls or meetings recorded yet today')

    const stats = { dialled, connected, meetingsBooked }

    // Organize past scrums by date, most recent first
    const pastMap = new Map<string, typeof scrumNotes>()
    for (const n of scrumNotes) {
      if (n.date === today) continue
      if (!pastMap.has(n.date)) pastMap.set(n.date, [])
      pastMap.get(n.date)!.push(n)
    }
    const past = Array.from(pastMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 14)
      .map(([date, slots]) => ({ date, slots }))

    const todayNotes = scrumNotes.filter(n => n.date === today)

    return NextResponse.json({ today, stats, suggestedItems, todayNotes, past })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const sheets = getSheets()
  await ensureScrumTab(sheets)

  const body = await req.json() as {
    date?: string
    slotTime?: string
    notes?: string
    actionItems?: string
    meetingHappened?: boolean
    rowIndex?: number
  }

  const date = body.date ?? todayIST()
  const slotTime = body.slotTime ?? ''

  if (body.rowIndex) {
    // Update existing row
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Scrum Notes'!C${body.rowIndex}:E${body.rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[body.notes ?? '', body.actionItems ?? '', body.meetingHappened !== false ? 'Yes' : 'No']] },
    })
  } else {
    // Append new row
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "'Scrum Notes'!A:E",
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[date, slotTime, body.notes ?? '', body.actionItems ?? '', body.meetingHappened !== false ? 'Yes' : 'No']] },
    })
  }

  return NextResponse.json({ ok: true })
}
