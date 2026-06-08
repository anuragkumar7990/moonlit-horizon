import { NextRequest, NextResponse } from 'next/server'
import { getSheets } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!

async function ensureTab(sheets: ReturnType<typeof getSheets>, title: string, headers: string[]) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const exists = meta.data.sheets?.some(s => (s.properties?.title ?? '') === title)
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${title}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headers] },
    })
  }
}

async function readTab(sheets: ReturnType<typeof getSheets>, tab: string): Promise<string[][]> {
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${tab}'!A:Z` })
    return (res.data.values ?? []).slice(1).filter(r => r.length > 0).map(r => r.map(c => String(c ?? '')))
  } catch { return [] }
}

export async function GET() {
  const sheets = getSheets()
  try {
    await Promise.all([
      ensureTab(sheets, 'Short-term Goals', ['ID', 'Title', 'TargetValue', 'CurrentValue', 'DueDate', 'Status']),
      ensureTab(sheets, 'Long-term Goals',  ['ID', 'Title', 'Description', 'StartDate', 'TargetDate', 'Owner', 'PercentComplete']),
      ensureTab(sheets, 'Goal Tasks',       ['ID', 'GoalID', 'Task', 'Assignee', 'DueDate', 'Status', 'PercentDone']),
    ])

    const [shortRows, longRows, taskRows] = await Promise.all([
      readTab(sheets, 'Short-term Goals'),
      readTab(sheets, 'Long-term Goals'),
      readTab(sheets, 'Goal Tasks'),
    ])

    const shortTerm = shortRows.map(r => ({
      id: r[0], title: r[1], targetValue: Number(r[2]) || 0,
      currentValue: Number(r[3]) || 0, dueDate: r[4] ?? '', status: r[5] ?? 'Active',
    }))

    const longTerm = longRows.map(r => ({
      id: r[0], title: r[1], description: r[2] ?? '',
      startDate: r[3] ?? '', targetDate: r[4] ?? '', owner: r[5] ?? '',
      percentComplete: Number(r[6]) || 0,
    }))

    const tasks = taskRows.map(r => ({
      id: r[0], goalId: r[1], task: r[2] ?? '', assignee: r[3] ?? '',
      dueDate: r[4] ?? '', status: r[5] ?? 'Pending', percentDone: Number(r[6]) || 0,
    }))

    return NextResponse.json({ shortTerm, longTerm, tasks })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const sheets = getSheets()
  const body = await req.json() as {
    type: 'short' | 'long' | 'task'
    data: Record<string, string | number>
  }
  const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const id = `${body.type.toUpperCase()}-${Date.now()}`

  try {
    if (body.type === 'short') {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "'Short-term Goals'!A:F",
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[id, body.data.title, body.data.targetValue ?? 0, 0, body.data.dueDate ?? nowIST, 'Active']] },
      })
    } else if (body.type === 'long') {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "'Long-term Goals'!A:G",
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[id, body.data.title, body.data.description ?? '', body.data.startDate ?? nowIST, body.data.targetDate ?? '', body.data.owner ?? '', 0]] },
      })
    } else if (body.type === 'task') {
      const taskId = `TSK-${Date.now()}`
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "'Goal Tasks'!A:G",
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[taskId, body.data.goalId, body.data.task, body.data.assignee ?? '', body.data.dueDate ?? '', 'Pending', 0]] },
      })
    }
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const sheets = getSheets()
  const body = await req.json() as {
    type: 'short' | 'long' | 'task'
    id: string
    field: string
    value: string | number
  }

  const tabMap: Record<string, string> = { short: 'Short-term Goals', long: 'Long-term Goals', task: 'Goal Tasks' }
  const colsMap: Record<string, string[]> = {
    short: ['ID', 'Title', 'TargetValue', 'CurrentValue', 'DueDate', 'Status'],
    long:  ['ID', 'Title', 'Description', 'StartDate', 'TargetDate', 'Owner', 'PercentComplete'],
    task:  ['ID', 'GoalID', 'Task', 'Assignee', 'DueDate', 'Status', 'PercentDone'],
  }
  const tab = tabMap[body.type]
  const cols = colsMap[body.type]
  const colIdx = cols.findIndex(c => c.toLowerCase() === body.field.toLowerCase())
  if (colIdx === -1) return NextResponse.json({ error: `Unknown field: ${body.field}` }, { status: 400 })

  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${tab}'!A:A` })
    const rows = res.data.values ?? []
    const rowIdx = rows.findIndex((r, i) => i > 0 && r[0] === body.id)
    if (rowIdx === -1) return NextResponse.json({ error: 'Row not found' }, { status: 404 })

    const colLetter = String.fromCharCode(65 + colIdx)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${tab}'!${colLetter}${rowIdx + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[body.value]] },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const sheets = getSheets()
  const { type, id } = await req.json() as { type: 'short' | 'long' | 'task'; id: string }

  const tabMap: Record<string, string> = { short: 'Short-term Goals', long: 'Long-term Goals', task: 'Goal Tasks' }
  const tab = tabMap[type]

  try {
    const idRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${tab}'!A:A` })
    const rows = idRes.data.values ?? []
    const rowIdx = rows.findIndex((r, i) => i > 0 && r[0] === id)
    if (rowIdx === -1) return NextResponse.json({ error: 'Row not found' }, { status: 404 })

    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
    const sheetId = meta.data.sheets?.find(s => (s.properties?.title ?? '') === tab)?.properties?.sheetId ?? 0

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowIdx, endIndex: rowIdx + 1 } } }] },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
