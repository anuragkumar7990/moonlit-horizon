import { NextRequest, NextResponse } from 'next/server'
import { getMeetings, getCalls, getSheets, getTargets, getTasks, getAccountIntelligence } from '@/lib/sheets'
import { getDeals, getZohoEvents } from '@/lib/zoho'
import { getCalendarEvents } from '@/lib/booking'

export const dynamic = 'force-dynamic'

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
function nowIST() { return new Date(Date.now() + IST_OFFSET_MS) }
function todayIST() { return nowIST().toISOString().slice(0, 10) }

const JUNK = ['untagged company', 'the test tribe', 'test']
const isJunk = (name: string) => JUNK.some(p => name.toLowerCase().includes(p))

function extractAccountFromTitle(title: string): string {
  const match = title.match(/^(.+?)\s*<>/)
  return match ? match[1].trim() : title
}

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
    const todayMonth = today.slice(0, 7)

    const [meetings, calls, scrumNotes, targets, tasks, accountIntel, deals, zohoEvents, calEvents] = await Promise.all([
      getMeetings(),
      getCalls(),
      readScrumNotes(sheets),
      getTargets().catch(() => []),
      getTasks().catch(() => []),
      getAccountIntelligence().catch(() => []),
      getDeals().catch(() => []),
      getZohoEvents(today).catch(() => []),
      getCalendarEvents(today, today).catch(() => []),
    ])

    // ── Daily targets (monthly ÷ 22) ─────────────────────────────────────────
    const monthTargets = targets.filter(t => t.month === todayMonth)
    const findTarget = (name: string) => monthTargets.find(t => t.metricName === name)?.targetValue ?? 0
    const dailyTargets = {
      dialled:        Math.round(findTarget('Calls Dialled') / 22),
      connected:      Math.round(findTarget('Calls Connected') / 22),
      meetingsBooked: Math.round(findTarget('Meetings Booked') / 22),
    }

    // ── Today's calls (stats) ─────────────────────────────────────────────────
    const todaysCalls = calls.filter(c => c.date === today)
    const dialled = todaysCalls.length
    const connected = todaysCalls.filter(c =>
      !['No Answer', 'Voicemail', 'Not Reachable', 'RNR', 'Busy', 'Unanswered'].some(s =>
        c.outcome?.toLowerCase().includes(s.toLowerCase())
      )
    ).length
    const meetingsBooked = todaysCalls.filter(c => c.outcome?.toLowerCase().includes('meeting')).length
    const stats = { dialled, connected, meetingsBooked }

    // ── Scheduled meetings today (Sheets + Zoho Events + Google Calendar deduped) ──
    const sheetsTodayMtgs = meetings.filter(m =>
      m.meetingTime?.slice(0, 10) === today && !isJunk(m.accountName)
    )
    const existingGMeetLinks = new Set(sheetsTodayMtgs.map(m => m.gMeetLink).filter(Boolean))
    const existingDealIds    = new Set(sheetsTodayMtgs.map(m => m.dealId).filter(Boolean))
    const existingZohoIds    = new Set(sheetsTodayMtgs.map(m => m.meetingId).filter(Boolean))

    const zohoTodayExtra = zohoEvents.filter(e => {
      const eDate = e.startDateTime?.slice(0, 10)
      if (eDate !== today) return false
      if (isJunk(e.whatName ?? '')) return false
      if (existingZohoIds.has(e.id)) return false
      if (e.whatId && existingDealIds.has(e.whatId)) return false
      return true
    })

    // Calendar-only events: TTT-related (title contains "Test Tribe" or "Upskilling") and not already in Sheets by GMeet link
    const TTT_CAL_PATTERNS = ['test tribe', 'upskilling', 'training', 'l1', 'l2']
    const calTodayExtra = calEvents.filter(e => {
      const lower = e.title.toLowerCase()
      if (!TTT_CAL_PATTERNS.some(p => lower.includes(p))) return false
      if (isJunk(e.title)) return false
      if (e.gMeetLink && existingGMeetLinks.has(e.gMeetLink)) return false
      return true
    })

    const intelByAccount = new Map(accountIntel.map(a => [a.account.toLowerCase(), a]))

    const scheduledMeetings = [
      ...sheetsTodayMtgs.map(m => ({
        meetingId:      m.meetingId,
        accountName:    m.accountName,
        contactName:    m.contactName,
        meetingType:    m.meetingType as string,
        conducted:      m.status === 'Conducted',
        startTime:      m.meetingTime,
        source:         'sheets' as const,
        circlebakNotes: intelByAccount.get(m.accountName.toLowerCase())?.circlebakIntelligence ?? null,
      })),
      ...zohoTodayExtra.map(e => ({
        meetingId:      e.id,
        accountName:    e.whatName ?? '',
        contactName:    e.whoName ?? '',
        meetingType:    e.subject?.toLowerCase().includes('l2') ? 'L2+' : 'L1',
        conducted:      false,
        startTime:      e.startDateTime,
        source:         'zoho' as const,
        circlebakNotes: intelByAccount.get((e.whatName ?? '').toLowerCase())?.circlebakIntelligence ?? null,
      })),
      ...calTodayExtra.map(e => {
        const account = extractAccountFromTitle(e.title)
        return {
          meetingId:      e.id,
          accountName:    account,
          contactName:    '',
          meetingType:    e.title.toLowerCase().includes('l2') || e.title.toLowerCase().includes('next steps') ? 'L2+' : 'L1',
          conducted:      false,
          startTime:      e.startTime,
          source:         'calendar' as const,
          circlebakNotes: intelByAccount.get(account.toLowerCase())?.circlebakIntelligence ?? null,
        }
      }),
    ]

    // ── Hot leads (active only — exclude Won) ─────────────────────────────────
    const hotLeads = deals
      .filter(d => d.temperature === 'Hot' && d.stage !== 'Lost' && d.stage !== 'Won')
      .map(d => ({ name: d.dealName, account: d.accountName || d.dealName, stage: d.stage, amount: d.amount }))

    // ── P0 tasks for today ────────────────────────────────────────────────────
    const p0Tasks = tasks
      .filter(t => t.type === 'P0' && t.status !== 'Completed' && t.date === today)
      .map(t => ({ task: t.task, linkedDeal: t.linkedDeal, type: t.type, status: t.status }))

    // ── Suggested discussion items ────────────────────────────────────────────
    const tomorrowIST = new Date(Date.now() + IST_OFFSET_MS + 86400000).toISOString().slice(0, 10)
    const tomorrowMtgs = meetings.filter(m => m.meetingTime?.slice(0, 10) === tomorrowIST && !isJunk(m.accountName))
    const suggestedItems: string[] = []
    if (dialled > 0) suggestedItems.push(`${dialled} calls dialled today, ${connected} connected, ${meetingsBooked} meetings booked`)
    if (scheduledMeetings.length > 0) suggestedItems.push(`${scheduledMeetings.length} meeting(s) scheduled today: ${scheduledMeetings.map(m => m.accountName).join(', ')}`)
    if (tomorrowMtgs.length > 0) suggestedItems.push(`${tomorrowMtgs.length} meeting(s) tomorrow: ${tomorrowMtgs.map(m => m.accountName).join(', ')}`)
    if (hotLeads.length > 0) suggestedItems.push(`${hotLeads.length} hot lead(s): ${hotLeads.map(l => l.account || l.name).join(', ')}`)
    if (suggestedItems.length === 0) suggestedItems.push('No calls or meetings recorded yet today')

    // ── Past scrums ───────────────────────────────────────────────────────────
    const pastMap = new Map<string, typeof scrumNotes>()
    for (const n of scrumNotes) {
      if (n.date === today) continue
      if (!pastMap.has(n.date)) pastMap.set(n.date, [])
      pastMap.get(n.date)!.push(n)
    }
    const past = Array.from(pastMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 30)
      .map(([date, slots]) => ({ date, slots }))

    const todayNotes = scrumNotes.filter(n => n.date === today)

    return NextResponse.json({
      today,
      stats,
      dailyTargets,
      scheduledMeetings,
      hotLeads,
      p0Tasks,
      suggestedItems,
      todayNotes,
      past,
    })
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
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Scrum Notes'!C${body.rowIndex}:E${body.rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[body.notes ?? '', body.actionItems ?? '', body.meetingHappened !== false ? 'Yes' : 'No']] },
    })
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "'Scrum Notes'!A:E",
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[date, slotTime, body.notes ?? '', body.actionItems ?? '', body.meetingHappened !== false ? 'Yes' : 'No']] },
    })
  }

  return NextResponse.json({ ok: true })
}
