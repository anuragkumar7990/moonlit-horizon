import { google } from 'googleapis'
import type { Meeting, Note, Communication, Account, Call, Target, Task } from './types'

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!

function getAuth() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return oauth2
}

function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() })
}

async function readSheet<T>(range: string, mapper: (row: string[]) => T): Promise<T[]> {
  const sheets = await getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  })
  const rows = res.data.values ?? []
  return rows.slice(1).filter(r => r.length > 0).map(mapper)
}

export async function getMeetings(): Promise<Meeting[]> {
  return readSheet<Meeting>('Meetings!A:J', (r) => ({
    meetingId: r[0] ?? '',
    accountName: r[1] ?? '',
    contactName: r[2] ?? '',
    contactEmail: r[3] ?? '',
    meetingTime: r[4] ?? '',
    meetingType: (r[5] as 'L1' | 'L2+') ?? 'L1',
    gMeetLink: r[6] ?? '',
    dealId: r[7] ?? '',
    status: r[8] ?? '',
    createdAt: r[9] ?? '',
  }))
}

export async function getNotes(): Promise<Note[]> {
  return readSheet<Note>('Notes!A:F', (r) => ({
    meetingId:   r[0] ?? '',
    accountName: r[1] ?? '',
    summary:     r[2] ?? '',
    actionables: r[3] ?? '',
    assignedTo:  r[4] ?? '',
    createdAt:   r[5] ?? '',
  }))
}

export async function getCalls(): Promise<Call[]> {
  return readSheet<Call>('Calls!A:N', (r) => ({
    date:               r[0]  ?? '',
    time:               r[1]  ?? '',
    account:            r[2]  ?? '',
    contactName:        r[3]  ?? '',
    contactPhone:       r[4]  ?? '',
    sdr:                r[5]  ?? '',
    duration:           r[6]  ?? '',
    outcome:            r[7]  ?? '',
    notes:              r[8]  ?? '',
    zohoCallId:         r[9]  ?? '',
    followUpDate:       r[10] ?? '',
    recordingLink:      r[11] ?? '',
    transcriptSummary:  r[12] ?? '',
    autoTags:           r[13] ?? '',
  }))
}

export async function getTargets(): Promise<Target[]> {
  return readSheet<Target>('Targets!A:D', (r) => ({
    month:        r[0] ?? '',
    metricName:   r[1] ?? '',
    targetValue:  Number(r[2] ?? 0),
    actualValue:  Number(r[3] ?? 0),
  }))
}

export async function getCommunications(): Promise<Communication[]> {
  return readSheet<Communication>('Communications!A:E', (r) => ({
    threadId: r[0] ?? '',
    accountName: r[1] ?? '',
    source: (r[2] as 'Discord' | 'Gmail') ?? 'Discord',
    messagePreview: r[3] ?? '',
    timestamp: r[4] ?? '',
  }))
}

export async function getAccounts(): Promise<Account[]> {
  return readSheet<Account>('Accounts!A:E', (r) => ({
    accountName: r[0] ?? '',
    primaryContact: r[1] ?? '',
    contactEmail: r[2] ?? '',
    stage: r[3] ?? '',
    lastActivity: r[4] ?? '',
  }))
}

const CALLS_HEADERS = [
  'Date', 'Time', 'Account', 'Contact Name', 'Contact Phone', 'SDR',
  'Duration', 'Outcome', 'Notes', 'Zoho Call ID', 'Follow-up Date',
  'Recording Drive Link', 'Transcript Summary', 'Auto Tags',
]

export async function appendCallRow(row: {
  date: string
  time: string
  account: string
  contactName: string
  contactPhone: string
  sdr: string
  outcome: string
  notes: string
  followUpDate: string
}): Promise<void> {
  const sheets = getSheets()

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const tabExists = meta.data.sheets?.some(s => s.properties?.title === 'Calls')
  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Calls' } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Calls!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [CALLS_HEADERS] },
    })
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Calls!A:N',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        row.date, row.time, row.account, row.contactName, row.contactPhone,
        row.sdr, '', row.outcome, row.notes, '',
        row.followUpDate, '', '', '',
      ]],
    },
  })
}

const TASKS_HEADERS = ['Date', 'Task', 'Type', 'Assigned To', 'Linked Deal', 'Status', 'Completed At']

export async function getTasks(): Promise<Task[]> {
  return readSheet<Task>('Tasks!A:G', (r) => ({
    date:        r[0] ?? '',
    task:        r[1] ?? '',
    type:        (r[2] as 'P0' | 'Objective') ?? 'P0',
    assignedTo:  r[3] ?? '',
    linkedDeal:  r[4] ?? '',
    status:      r[5] ?? '',
    completedAt: r[6] ?? '',
  }))
}

export async function appendTaskRows(rows: {
  date: string
  task: string
  type: 'P0' | 'Objective'
  assignedTo: string
  linkedDeal: string
  status: string
}[]): Promise<void> {
  if (rows.length === 0) return
  const sheets = getSheets()

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const tabExists = meta.data.sheets?.some(s => s.properties?.title === 'Tasks')
  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Tasks' } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Tasks!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [TASKS_HEADERS] },
    })
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Tasks!A:G',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: rows.map(r => [r.date, r.task, r.type, r.assignedTo, r.linkedDeal, r.status, '']),
    },
  })
}

export async function clearTasksSheet(): Promise<void> {
  const sheets = getSheets()
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Tasks!A2:G',
  })
}

export async function updateTaskStatus(linkedDeal: string, status: 'Done' | 'Open'): Promise<void> {
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Tasks!A:G',
  })
  const rows = res.data.values ?? []
  const rowIdx = rows.findIndex((r, i) => i > 0 && r[4] === linkedDeal)
  if (rowIdx === -1) throw new Error(`Task not found: ${linkedDeal}`)

  const sheetRow = rowIdx + 1
  const now = new Date()
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
  const completedAt = status === 'Done'
    ? `${ist.toISOString().slice(0, 10)} ${ist.toISOString().slice(11, 16)}`
    : ''

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Tasks!F${sheetRow}:G${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[status, completedAt]] },
  })
}

const PROSPECTS_HEADERS = ['Date', 'Email', 'First Name', 'Last Name', 'Company', 'Designation', 'City', 'Phone', 'Lvl 1 Source', 'Lvl 2 Source', 'Priority', 'Status']

export async function appendProspectRows(rows: {
  date: string
  email: string
  firstName: string
  lastName: string
  company: string
  designation?: string
  city?: string
  phone?: string
  lvl1Source?: string
  lvl2Source?: string
  priority?: string
  status: 'created' | 'updated'
}[]): Promise<void> {
  if (rows.length === 0) return
  const sheets = getSheets()

  // Create "Prospects" tab with headers if it doesn't exist yet
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const tabExists = meta.data.sheets?.some(s => s.properties?.title === 'Prospects')
  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Prospects' } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Prospects!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [PROSPECTS_HEADERS] },
    })
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Prospects!A:L',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: rows.map(r => [
        r.date, r.email, r.firstName, r.lastName, r.company ?? '',
        r.designation ?? '', r.city ?? '', r.phone ?? '',
        r.lvl1Source ?? '', r.lvl2Source ?? '', r.priority ?? '', r.status,
      ]),
    },
  })
}

// ── Targets sheet ────────────────────────────────────────────────────────────

const TARGETS_HEADERS = ['Month', 'Metric Name', 'Target Value', 'Actual Value']

export async function upsertTarget(month: string, metricName: string, targetValue: number): Promise<void> {
  const sheets = getSheets()

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const tabExists = meta.data.sheets?.some(s => s.properties?.title === 'Targets')
  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Targets' } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Targets!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [TARGETS_HEADERS] },
    })
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Targets!A:D',
  })
  const rows = res.data.values ?? []
  const rowIdx = rows.findIndex((r, i) => i > 0 && r[0] === month && r[1] === metricName)

  if (rowIdx !== -1) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Targets!C${rowIdx + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[targetValue]] },
    })
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Targets!A:D',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[month, metricName, targetValue, 0]] },
    })
  }
}

// ── Summaries sheet ──────────────────────────────────────────────────────────
// Columns: Week Of | Generated At | Summary

export interface Summary {
  weekOf: string
  generatedAt: string
  summary: string
}

export async function getLatestSummary(): Promise<Summary | null> {
  try {
    const rows = await readSheet<Summary>('Summaries!A:C', (r) => ({
      weekOf: r[0] ?? '',
      generatedAt: r[1] ?? '',
      summary: r[2] ?? '',
    }))
    if (rows.length === 0) return null
    return rows[rows.length - 1]
  } catch { return null }
}

export async function saveSummary(weekOf: string, summary: string): Promise<void> {
  const sheets = getSheets()
  const now = new Date()
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
  const generatedAt = `${ist.toISOString().slice(0, 10)} ${ist.toISOString().slice(11, 16)}`

  // Ensure Summaries tab exists
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const tabExists = meta.data.sheets?.some(s => s.properties?.title === 'Summaries')
  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Summaries' } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Summaries!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['Week Of', 'Generated At', 'Summary']] },
    })
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Summaries!A:C',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[weekOf, generatedAt, summary]] },
  })
}
