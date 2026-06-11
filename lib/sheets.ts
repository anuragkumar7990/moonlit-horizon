import { google } from 'googleapis'
import type { Meeting, Note, Communication, Account, Call, Target, Task } from './types'

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!

const TRAINER_OUTREACH_SHEET_ID = '1Xol3kb_5GDxS-Su-fAs1tIvTSLfGahNXWHv0MKUOY9I'
const TRAINER_SUPPLY_SHEET_ID   = '1R8FqcifveekYZsaS3taHARaQAo3CjZ0FqdHnNOcZg2U'

function getAuth() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return oauth2
}

export function getSheets() {
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

export async function updateMeetingConducted(rowIndex: number): Promise<void> {
  const sheets = getSheets()
  // Row 1 = headers, data starts at row 2, so sheetRow = rowIndex + 2
  const sheetRow = rowIndex + 2
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Meetings!I${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['Conducted']] },
  })
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
  return readSheet<Call>('Calls!A:P', (r) => ({
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
    email:              r[14] ?? '',
    designation:        r[15] ?? '',
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
  'Email', 'Designation',
]

// Returns the 1-indexed sheet row number that was written (used to back-fill Zoho Call ID).
export async function appendCallRow(row: {
  date: string
  time: string
  account: string
  contactName: string
  contactPhone: string
  email?: string
  designation?: string
  sdr: string
  duration?: string
  outcome: string
  notes: string
  followUpDate: string
  zohoCallId?: string
}): Promise<number> {
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

  const result = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Calls!A:P',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        row.date, row.time, row.account, row.contactName, row.contactPhone,
        row.sdr, row.duration ?? '', row.outcome, row.notes, row.zohoCallId ?? '',
        row.followUpDate, '', '', '',
        row.email ?? '', row.designation ?? '',
      ]],
    },
  })

  // Parse row number from updatedRange e.g. "Calls!A5:P5" → 5
  const match = result.data.updates?.updatedRange?.match(/!A(\d+)/)
  return match ? parseInt(match[1]) : -1
}

export async function updateCallRowZohoId(rowNum: number, zohoCallId: string): Promise<void> {
  const sheets = getSheets()
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Calls!J${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[zohoCallId]] },
  })
}

export async function appendMeetingRow(row: {
  meetingId: string
  accountName: string
  contactName: string
  contactEmail: string
  meetingTime: string
  meetingType: string
  gMeetLink: string
  dealId: string
  status: string
  createdAt: string
}): Promise<void> {
  const sheets = getSheets()
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Meetings!A:J',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        row.meetingId, row.accountName, row.contactName, row.contactEmail,
        row.meetingTime, row.meetingType, row.gMeetLink, row.dealId,
        row.status, row.createdAt,
      ]],
    },
  })
}

export async function callExistsInSheetByZohoId(zohoCallId: string): Promise<boolean> {
  const sheets = getSheets()
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Calls!J:J',
    })
    return (res.data.values ?? []).some(r => r[0] === zohoCallId)
  } catch {
    return false
  }
}

export async function getAllZohoCallIdsFromSheet(): Promise<Set<string>> {
  const sheets = getSheets()
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Calls!J:J' })
    return new Set((res.data.values ?? []).flat().filter(Boolean).map(String))
  } catch { return new Set() }
}

// Returns map of zohoCallId → { rowIndex (1-based, incl. header), account, contactName }
export async function getAllCallRowsFromSheet(): Promise<Map<string, { rowIndex: number; account: string; contactName: string }>> {
  const sheets = getSheets()
  const result = new Map<string, { rowIndex: number; account: string; contactName: string }>()
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Calls!A:J' })
    const rows = res.data.values ?? []
    for (let i = 1; i < rows.length; i++) {
      const zohoId = String(rows[i][9] ?? '').trim()
      if (zohoId) result.set(zohoId, {
        rowIndex: i + 1,
        account: String(rows[i][2] ?? ''),
        contactName: String(rows[i][3] ?? ''),
      })
    }
  } catch { /* return empty */ }
  return result
}

async function getCallsSheetId(sheets: ReturnType<typeof getSheets>): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const sheet = meta.data.sheets?.find(s => s.properties?.title === 'Calls')
  return sheet?.properties?.sheetId ?? 0
}

// Deletes Calls rows by Zoho call ID (col J). Bottom-up to avoid index shifting.
export async function deleteCallRowsByZohoId(zohoIds: string[]): Promise<number> {
  if (zohoIds.length === 0) return 0
  const sheets = getSheets()
  const idSet = new Set(zohoIds.map(id => id.trim()))

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Calls!J:J' })
  const rows = res.data.values ?? []

  const toDelete: number[] = []
  for (let i = 1; i < rows.length; i++) {
    const id = String(rows[i][0] ?? '').trim()
    if (idSet.has(id)) toDelete.push(i + 1)
  }
  if (toDelete.length === 0) return 0

  const sheetId = await getCallsSheetId(sheets)
  const requests = [...toDelete].reverse().map(rowIndex => ({
    deleteDimension: {
      range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex },
    },
  }))
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests } })
  return toDelete.length
}

// Deletes Calls rows where account name (col C) exactly matches any given name,
// or starts with "Untagged Company #" when deleteUntagged is true.
// Rows are deleted bottom-up to avoid index shifting. Returns count of rows deleted.
export async function deleteCallRowsByAccountNames(accountNames: string[], deleteUntagged = false): Promise<number> {
  const sheets = getSheets()
  const nameSet = new Set(accountNames.map(n => n.toLowerCase().trim()))

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Calls!A:C' })
  const rows = res.data.values ?? []

  // Collect 1-based sheet row numbers to delete (skip header at index 0)
  const toDelete: number[] = []
  for (let i = 1; i < rows.length; i++) {
    const account = String(rows[i][2] ?? '').toLowerCase().trim()
    const isUntagged = account.startsWith('untagged company #')
    if (nameSet.has(account) || (deleteUntagged && isUntagged)) toDelete.push(i + 1)
  }
  if (toDelete.length === 0) return 0

  const sheetId = await getCallsSheetId(sheets)

  // Delete bottom-up so row indices stay valid
  const requests = [...toDelete].reverse().map(rowIndex => ({
    deleteDimension: {
      range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex },
    },
  }))

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  })
  return toDelete.length
}

export async function updateCallAccountRow(
  rowIndex: number,
  account: string,
  contactName: string,
  contactPhone: string,
  email?: string,
  designation?: string,
  duration?: string,
): Promise<void> {
  const sheets = getSheets()
  const data: { range: string; values: string[][] }[] = [
    { range: `Calls!C${rowIndex}`, values: [[account]] },
    { range: `Calls!D${rowIndex}`, values: [[contactName]] },
    { range: `Calls!E${rowIndex}`, values: [[contactPhone]] },
  ]
  if (email)       data.push({ range: `Calls!O${rowIndex}`, values: [[email]] })
  if (designation) data.push({ range: `Calls!P${rowIndex}`, values: [[designation]] })
  if (duration)    data.push({ range: `Calls!G${rowIndex}`, values: [[duration]] })
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  })
}

const CI_NAME_COL    = 3   // D — Name
const CI_EMAIL_COL   = 4   // E — Email (lookup key)
const CI_COMP_COL    = 7   // H — Company
const CI_TOTAL_COL   = 12  // M — Total Calls
const CI_CONNECT_COL = 13  // N — Calls Connected
const CI_RATE_COL    = 14  // O — Connection Rate %
const CI_LASTD_COL   = 17  // R — Last Call Date
const CI_LASTO_COL   = 18  // S — Last Call Outcome
const CI_HIST_COL    = 20  // U — Call History (JSON)
const CI_UPDAT_COL   = 23  // X — Updated At

const CI_NOT_CONNECTED = new Set([
  'rnr', 'rang no response',
  'wrong number',
  'incoming not available',
])

export async function upsertContactIntelRow(email: string, call: {
  date: string
  time: string
  outcome: string
  notes: string
  duration: string
  zohoCallId: string
}): Promise<void> {
  if (!email) return
  const sheets = getSheets()

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Contact Intelligence!A:X',
  })
  const rows = res.data.values ?? []
  // Row index 0 = headers; data rows start at index 1 (sheet row 2)
  const rowIdx = rows.findIndex((r, i) => i > 0 && (r[CI_EMAIL_COL] ?? '').toLowerCase() === email.toLowerCase())
  if (rowIdx === -1) return  // contact not in Contact Intelligence — skip silently

  const row = rows[rowIdx]
  const sheetRowNum = rowIdx + 1  // 1-indexed

  // Append to call history JSON
  let history: unknown[] = []
  try { history = JSON.parse(row[CI_HIST_COL] ?? '[]') } catch { /* keep empty */ }
  history.push({ date: call.date, time: call.time, outcome: call.outcome, notes: call.notes, duration: call.duration, zohoCallId: call.zohoCallId })

  const totalCalls = (Number(row[CI_TOTAL_COL]) || 0) + 1
  const isConn = call.outcome !== '' && !CI_NOT_CONNECTED.has(call.outcome.toLowerCase().trim())
  const connected  = (Number(row[CI_CONNECT_COL]) || 0) + (isConn ? 1 : 0)
  const rate       = Math.round((connected / totalCalls) * 100)

  const existingLastDate = String(row[CI_LASTD_COL] ?? '')
  const isNewer = !existingLastDate || call.date >= existingLastDate

  const now = new Date().toISOString()
  const updates: { range: string; values: unknown[][] }[] = [
    { range: `Contact Intelligence!M${sheetRowNum}`, values: [[totalCalls]] },
    { range: `Contact Intelligence!N${sheetRowNum}`, values: [[connected]] },
    { range: `Contact Intelligence!O${sheetRowNum}`, values: [[rate]] },
    { range: `Contact Intelligence!U${sheetRowNum}`, values: [[JSON.stringify(history)]] },
    { range: `Contact Intelligence!X${sheetRowNum}`, values: [[now]] },
  ]
  if (isNewer) {
    updates.push({ range: `Contact Intelligence!R${sheetRowNum}`, values: [[call.date]] })
    updates.push({ range: `Contact Intelligence!S${sheetRowNum}`, values: [[call.outcome]] })
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: updates },
  })
}

export interface CIFollowUp {
  name: string
  company: string
  email: string
  lastCallDate: string
  lastCallOutcome: string
}

const CI_FOLLOWUP_OUTCOMES_NORM = new Set(['call back later', 'send more info', 'callback later'])

export async function getContactIntelFollowUps(): Promise<CIFollowUp[]> {
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Contact Intelligence!A:S',  // cols A-S only, skip JSON blob in col U
  })
  const rows = res.data.values ?? []
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const result: CIFollowUp[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const outcome = (r[CI_LASTO_COL] ?? '').trim()
    if (!CI_FOLLOWUP_OUTCOMES_NORM.has(outcome.toLowerCase())) continue
    const lastCallDate = r[CI_LASTD_COL] ?? ''
    if (!lastCallDate || lastCallDate < cutoffStr) continue  // skip stale / undated
    const email = r[CI_EMAIL_COL] ?? ''
    if (!email) continue
    result.push({
      name:            r[CI_NAME_COL] ?? '',
      company:         r[CI_COMP_COL] ?? '',
      email,
      lastCallDate,
      lastCallOutcome: outcome,
    })
  }
  return result
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

export async function patchTask(linkedDeal: string, fields: { task?: string; assignedTo?: string }): Promise<void> {
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Tasks!A:G' })
  const rows = res.data.values ?? []
  const rowIdx = rows.findIndex((r, i) => i > 0 && r[4] === linkedDeal)
  if (rowIdx === -1) throw new Error(`Task not found: ${linkedDeal}`)
  const sheetRow = rowIdx + 1
  const updates: { range: string; values: unknown[][] }[] = []
  if (fields.task !== undefined)       updates.push({ range: `Tasks!B${sheetRow}`, values: [[fields.task]] })
  if (fields.assignedTo !== undefined) updates.push({ range: `Tasks!D${sheetRow}`, values: [[fields.assignedTo]] })
  if (updates.length === 0) return
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: updates },
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

export interface Prospect {
  date: string
  email: string
  firstName: string
  lastName: string
  company: string
  designation: string
  city: string
  phone: string
  lvl1Source: string
  lvl2Source: string
  priority: string
  status: string
}

export async function getProspects(): Promise<Prospect[]> {
  try {
    return readSheet<Prospect>('Prospects!A:L', (r) => ({
      date:        r[0]  ?? '',
      email:       r[1]  ?? '',
      firstName:   r[2]  ?? '',
      lastName:    r[3]  ?? '',
      company:     r[4]  ?? '',
      designation: r[5]  ?? '',
      city:        r[6]  ?? '',
      phone:       r[7]  ?? '',
      lvl1Source:  r[8]  ?? '',
      lvl2Source:  r[9]  ?? '',
      priority:    r[10] ?? '',
      status:      r[11] ?? '',
    }))
  } catch { return [] }
}

export async function getProspectByEmail(email: string): Promise<{
  company: string; designation: string; phone: string; firstName: string; lastName: string
} | null> {
  if (!email) return null
  try {
    const sheets = getSheets()
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Prospects!A:H',
    })
    const rows = res.data.values ?? []
    const needle = email.toLowerCase().trim()
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      if ((r[1] ?? '').toString().toLowerCase().trim() === needle) {
        return {
          company:     (r[4] ?? '').toString().trim(),
          designation: (r[5] ?? '').toString().trim(),
          phone:       (r[7] ?? '').toString().trim(),
          firstName:   (r[2] ?? '').toString().trim(),
          lastName:    (r[3] ?? '').toString().trim(),
        }
      }
    }
    return null
  } catch { return null }
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

export async function getEmailListCounts(): Promise<Record<string, number>> {
  try {
    const sheets = getSheets()
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Prospects!I:J',
    })
    const rows = res.data.values ?? []
    const counts: Record<string, number> = {}
    for (let i = 1; i < rows.length; i++) {
      const lvl1 = (rows[i][0] ?? '').trim()
      const lvl2 = (rows[i][1] ?? '').trim()
      if (lvl1.toLowerCase() === 'email' && lvl2) {
        counts[lvl2] = (counts[lvl2] ?? 0) + 1
      }
    }
    return counts
  } catch { return {} }
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

export async function getRecentSummaries(n = 4): Promise<Summary[]> {
  try {
    const rows = await readSheet<Summary>('Summaries!A:C', (r) => ({
      weekOf: r[0] ?? '',
      generatedAt: r[1] ?? '',
      summary: r[2] ?? '',
    }))
    return rows.slice(-n).reverse()
  } catch { return [] }
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

// ── Payments sheet ───────────────────────────────────────────────────────────
// Columns: Date | Account | Deal | Amount | Invoice Date | Due Date | Status | Notes

export interface Payment {
  date: string
  account: string
  deal: string
  amount: number
  invoiceDate: string
  dueDate: string
  status: 'Invoiced' | 'Received' | 'Partial' | 'Overdue'
  notes: string
  attachmentUrl?: string
}

const PAYMENTS_HEADERS = ['Date', 'Account', 'Deal', 'Amount', 'Invoice Date', 'Due Date', 'Status', 'Notes', 'Attachment URL']

export async function getPayments(): Promise<Payment[]> {
  try {
    return readSheet<Payment>('Payments!A:I', (r) => ({
      date:          r[0] ?? '',
      account:       r[1] ?? '',
      deal:          r[2] ?? '',
      amount:        parseInt(r[3] ?? '0', 10) || 0,
      invoiceDate:   r[4] ?? '',
      dueDate:       r[5] ?? '',
      status:        (r[6] as Payment['status']) ?? 'Invoiced',
      notes:         r[7] ?? '',
      attachmentUrl: r[8] ?? undefined,
    }))
  } catch { return [] }
}

export async function appendPaymentRow(row: {
  account: string
  deal: string
  amount: number
  invoiceDate: string
  dueDate: string
  notes?: string
  attachmentUrl?: string
}): Promise<void> {
  const sheets = getSheets()

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const tabExists = meta.data.sheets?.some(s => s.properties?.title === 'Payments')
  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Payments' } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Payments!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [PAYMENTS_HEADERS] },
    })
  }

  const now = new Date()
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
  const date = ist.toISOString().slice(0, 10)

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Payments!A:H',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[date, row.account, row.deal, row.amount, row.invoiceDate, row.dueDate, 'Invoiced', row.notes ?? '', row.attachmentUrl ?? '']],
    },
  })
}

// ── Trainer Supply (external sheets) ────────────────────────────────────────

async function readRawSheet(spreadsheetId: string, range: string): Promise<string[][]> {
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })
  return (res.data.values ?? []).map(r => r.map((c: unknown) => String(c ?? '')))
}

export interface TrainerPipelineSummary {
  outreachTotal: number
  connected: number
  formFilled: number
  emailSent: number
  whatsappSent: number
  meetingBooked: number
  meetingConducted: number
  sampleTaken: number
  onboarded: number
}

export async function getTrainerPipeline(): Promise<TrainerPipelineSummary> {
  const empty: TrainerPipelineSummary = {
    outreachTotal: 0, connected: 0, formFilled: 0,
    emailSent: 0, whatsappSent: 0, meetingBooked: 0,
    meetingConducted: 0, sampleTaken: 0, onboarded: 0,
  }
  try {
    const rows = await readRawSheet(TRAINER_OUTREACH_SHEET_ID, 'A:H')
    let formFilled = 0
    let outreachTotal = 0
    let connected = 0
    const seenNames = new Set<string>()

    for (const row of rows) {
      const col0 = row[0].trim()
      const col2 = row[2].trim().toLowerCase()
      const col3 = row[3].trim()

      // Form response row: col A is "DD/MM/YYYY HH:MM:SS"
      if (/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(col0)) {
        if (!col2.startsWith('test@') && !col2.includes('@123')) formFilled++
      }

      // Outreach tracker row: col D is exactly TRUE or FALSE; col A is a trainer name
      if ((col3 === 'TRUE' || col3 === 'FALSE') && col0 && col0 !== 'Name' && col0 !== 'Connection Status') {
        const key = col0.toLowerCase()
        if (!seenNames.has(key)) {
          seenNames.add(key)
          outreachTotal++
          if (col3 === 'TRUE') connected++
        }
      }
    }

    return { ...empty, outreachTotal, connected, formFilled }
  } catch { return empty }
}

export interface TrainerRosterEntry {
  name: string
  profileDetails: string
  tier: 'Tier-1' | 'Tier-2' | 'Tier-3'
  score: number
  skills: string[]
}

export async function getTrainerRoster(): Promise<TrainerRosterEntry[]> {
  try {
    const rows = await readRawSheet(TRAINER_SUPPLY_SHEET_ID, 'A:L')

    // Find trainer profiles table: col0='Trainer Name', col2='Tier', col3='Total Score'
    let profilesStart = -1
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0].trim() === 'Trainer Name' && rows[i][2].trim() === 'Tier' && rows[i][3].trim() === 'Total Score') {
        profilesStart = i + 1
        break
      }
    }
    if (profilesStart === -1) return []

    const trainers: TrainerRosterEntry[] = []
    for (let i = profilesStart; i < rows.length; i++) {
      const name = rows[i][0].trim()
      if (!name || name === 'Trainer Name') break
      const tier = rows[i][2].trim() as 'Tier-1' | 'Tier-2' | 'Tier-3'
      if (!['Tier-1', 'Tier-2', 'Tier-3'].includes(tier)) continue
      trainers.push({
        name,
        profileDetails: rows[i][1].trim(),
        tier,
        score: parseInt(rows[i][3], 10) || 0,
        skills: [],
      })
    }

    // Find trainer-skill table: col0='Trainer Name', col1='Skill Name'
    let skillsStart = -1
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0].trim() === 'Trainer Name' && rows[i][1].trim() === 'Skill Name') {
        skillsStart = i + 1
        break
      }
    }
    if (skillsStart !== -1) {
      const skillMap = new Map<string, string[]>()
      for (let i = skillsStart; i < rows.length; i++) {
        const trainerName = rows[i][0].trim()
        const skill = rows[i][1].trim()
        if (!trainerName || !skill || trainerName === 'Trainer Name') continue
        if (!skillMap.has(trainerName)) skillMap.set(trainerName, [])
        skillMap.get(trainerName)!.push(skill)
      }
      for (const t of trainers) t.skills = skillMap.get(t.name) ?? []
    }

    return trainers
  } catch { return [] }
}

export interface TopicCoverageEntry {
  topic: string
  category: string
  trainers: string[]
  tier1Price: number
  tier2Price: number
  tier3Price: number
}

export async function getTopicCoverage(): Promise<TopicCoverageEntry[]> {
  try {
    const rows = await readRawSheet(TRAINER_SUPPLY_SHEET_ID, 'A:J')
    const parsePrice = (s: string) => parseInt(s.replace(/[₹,\s]/g, ''), 10) || 0

    // Customer pricing table: col3 = 'Price Range' (not 'Category Scale Range')
    const pricingMap = new Map<string, { t1: number; t2: number; t3: number }>()
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][3].trim() === 'Price Range') {
        for (let j = i + 1; j < rows.length; j++) {
          const topic = rows[j][0].trim()
          if (!topic || rows[j][3].trim() === 'Category Scale Range') break
          pricingMap.set(topic, {
            t1: parsePrice(rows[j][4]),
            t2: parsePrice(rows[j][5]),
            t3: parsePrice(rows[j][6]),
          })
        }
        break
      }
    }

    // Topic → trainer ranking table: col2 = 'Trainer 1'
    let topicStart = -1
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0].trim() === 'Topic' && rows[i][2].trim() === 'Trainer 1') {
        topicStart = i + 1
        break
      }
    }
    if (topicStart === -1) return []

    const coverage: TopicCoverageEntry[] = []
    for (let i = topicStart; i < rows.length; i++) {
      const topic = rows[i][0].trim()
      if (!topic || rows[i][2].trim() === 'Trainer 1') break
      const pricing = pricingMap.get(topic) ?? { t1: 0, t2: 0, t3: 0 }
      coverage.push({
        topic,
        category: rows[i][1].trim(),
        trainers: rows[i].slice(2).map(t => t.trim()).filter(Boolean),
        tier1Price: pricing.t1,
        tier2Price: pricing.t2,
        tier3Price: pricing.t3,
      })
    }
    return coverage
  } catch { return [] }
}

// ── Account Intelligence sheet ───────────────────────────────────────────────
// Columns A:L — Account | Updated At | Meeting Count | Last Meeting | Status |
//               Email Intelligence | Circleback Intelligence | Call Intelligence |
//               Manual Notes | Cumulative Summary | Next Action | Last Contact Date

export interface AccountIntelligence {
  account: string
  updatedAt: string
  meetingCount: number
  lastMeeting: string
  status: 'Won' | 'Active' | 'Warm' | 'Cold' | 'Dead'
  emailIntelligence: string
  circlebakIntelligence: string
  callIntelligence: string
  manualNotes: string
  cumulativeSummary: string
  nextAction: string
  lastContactDate: string
}

const ACCOUNT_INTEL_HEADERS = [
  'Account', 'Updated At', 'Meeting Count', 'Last Meeting', 'Status',
  'Email Intelligence', 'Circleback Intelligence', 'Call Intelligence',
  'Manual Notes', 'Cumulative Summary', 'Next Action', 'Last Contact Date',
]

function istNowSheets(): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  return `${ist.toISOString().slice(0, 10)} ${ist.toISOString().slice(11, 16)}`
}

export async function getAccountIntelligence(): Promise<AccountIntelligence[]> {
  try {
    return readSheet<AccountIntelligence>('Account Intelligence!A:L', (r) => ({
      account:               r[0]  ?? '',
      updatedAt:             r[1]  ?? '',
      meetingCount:          parseInt(r[2] ?? '0', 10) || 0,
      lastMeeting:           r[3]  ?? '',
      status:                (r[4] as AccountIntelligence['status']) ?? 'Cold',
      emailIntelligence:     r[5]  ?? '',
      circlebakIntelligence: r[6]  ?? '',
      callIntelligence:      r[7]  ?? '',
      manualNotes:           r[8]  ?? '',
      cumulativeSummary:     r[9]  ?? '',
      nextAction:            r[10] ?? '',
      lastContactDate:       r[11] ?? '',
    }))
  } catch { return [] }
}

async function findAccountRow(account: string, range: string): Promise<number> {
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range })
  const rows = res.data.values ?? []
  const norm = (s: string) => s.toLowerCase().trim()
  return rows.findIndex((r, i) => i > 0 && norm(r[0] ?? '') === norm(account))
}

export async function upsertAccountIntelligence(intel: AccountIntelligence): Promise<void> {
  const sheets = getSheets()

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const tabExists = meta.data.sheets?.some(s => s.properties?.title === 'Account Intelligence')
  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Account Intelligence' } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Account Intelligence!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [ACCOUNT_INTEL_HEADERS] },
    })
  }

  const rowIdx = await findAccountRow(intel.account, 'Account Intelligence!A:A')
  const row = [
    intel.account, intel.updatedAt, intel.meetingCount, intel.lastMeeting, intel.status,
    intel.emailIntelligence, intel.circlebakIntelligence, intel.callIntelligence,
    intel.manualNotes, intel.cumulativeSummary, intel.nextAction, intel.lastContactDate ?? '',
  ]

  if (rowIdx !== -1) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Account Intelligence!A${rowIdx + 1}:L${rowIdx + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    })
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Account Intelligence!A:L',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    })
  }
}

export async function appendManualNote(account: string, note: string): Promise<string> {
  const sheets = getSheets()
  const ts = istNowSheets()
  const newEntry = `[${ts} IST] ${note}`

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Account Intelligence!A:I',
  })
  const rows = res.data.values ?? []
  const norm = (s: string) => s.toLowerCase().trim()
  const rowIdx = rows.findIndex((r, i) => i > 0 && norm(r[0] ?? '') === norm(account))

  if (rowIdx === -1) {
    // Account not in sheet yet — create a new row with just the manual note
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Account Intelligence!A:L',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[account, ts, 0, '', 'Cold', '', '', '', newEntry, '', '', '']],
      },
    })
    return newEntry
  }

  const existing = rows[rowIdx][8] ?? ''
  const updated = existing ? `${existing}\n${newEntry}` : newEntry

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Account Intelligence!I${rowIdx + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[updated]] },
  })

  return updated
}

export async function updateAccountStatus(
  account: string,
  status: AccountIntelligence['status']
): Promise<void> {
  const sheets = getSheets()
  const rowIdx = await findAccountRow(account, 'Account Intelligence!A:A')
  if (rowIdx === -1) throw new Error(`Account not found: ${account}`)

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Account Intelligence!E${rowIdx + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[status]] },
  })
}

export async function updateCallIntelligence(account: string, callIntelligence: string): Promise<void> {
  const sheets = getSheets()
  const rowIdx = await findAccountRow(account, 'Account Intelligence!A:A')
  if (rowIdx === -1) throw new Error(`Account not found: ${account}`)

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `Account Intelligence!B${rowIdx + 1}`, values: [[istNowSheets()]] },
        { range: `Account Intelligence!H${rowIdx + 1}`, values: [[callIntelligence]] },
      ],
    },
  })
}

export async function updateCirclebakIntelligence(account: string, circlebakIntelligence: string): Promise<void> {
  const sheets = getSheets()
  const rowIdx = await findAccountRow(account, 'Account Intelligence!A:A')
  if (rowIdx === -1) throw new Error(`Account not found: ${account}`)

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `Account Intelligence!B${rowIdx + 1}`, values: [[istNowSheets()]] },
        { range: `Account Intelligence!G${rowIdx + 1}`, values: [[circlebakIntelligence]] },
      ],
    },
  })
}

export async function updateEmailIntelligence(account: string, emailIntelligence: string): Promise<void> {
  const sheets = getSheets()
  const rowIdx = await findAccountRow(account, 'Account Intelligence!A:A')
  if (rowIdx === -1) throw new Error(`Account not found: ${account}`)

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `Account Intelligence!B${rowIdx + 1}`, values: [[istNowSheets()]] },
        { range: `Account Intelligence!F${rowIdx + 1}`, values: [[emailIntelligence]] },
      ],
    },
  })
}

export async function updateCumulativeInSheet(
  account: string,
  cumulativeSummary: string,
  nextAction: string,
  lastContactDate?: string
): Promise<void> {
  const sheets = getSheets()
  const rowIdx = await findAccountRow(account, 'Account Intelligence!A:A')
  if (rowIdx === -1) return // row was just created with no intel layers yet — skip

  const data: { range: string; values: unknown[][] }[] = [
    { range: `Account Intelligence!B${rowIdx + 1}`, values: [[istNowSheets()]] },
    { range: `Account Intelligence!J${rowIdx + 1}:K${rowIdx + 1}`, values: [[cumulativeSummary, nextAction]] },
  ]
  if (lastContactDate !== undefined) {
    data.push({ range: `Account Intelligence!L${rowIdx + 1}`, values: [[lastContactDate]] })
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  })
}

export async function updateLastContactDate(account: string, date: string): Promise<void> {
  const sheets = getSheets()
  const rowIdx = await findAccountRow(account, 'Account Intelligence!A:A')
  if (rowIdx === -1) throw new Error(`Account not found: ${account}`)

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Account Intelligence!L${rowIdx + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[date]] },
  })
}

// ── Notes append ─────────────────────────────────────────────────────────────

export async function appendNoteRow(row: {
  meetingId: string
  accountName: string
  summary: string
  actionables: string
  assignedTo: string
}): Promise<void> {
  const sheets = getSheets()
  const now = new Date()
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
  const createdAt = `${ist.toISOString().slice(0, 10)} ${ist.toISOString().slice(11, 16)}`

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Notes!A:F',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[row.meetingId, row.accountName, row.summary, row.actionables, row.assignedTo, createdAt]],
    },
  })
}

// ── Contact Intelligence (light read — skips JSON blob in col U) ─────────────

export interface ContactIntelRow {
  zohoLeadId:       string
  zohoContactId:    string
  zohoDealId:       string
  name:             string
  email:            string
  phone:            string
  title:            string
  company:          string
  l1Source:         string
  l2Source:         string
  sdr:              string
  totalCalls:       number
  connectedCalls:   number
  connectionRate:   number
  lastCallDate:     string
  lastCallOutcome:  string
  zohoStage:        string
}

export async function getContactIntelligence(): Promise<ContactIntelRow[]> {
  try {
    // Only read A:S — skips the JSON blob in col U which is large
    // Column indices match the constants CI_TOTAL_COL=12, CI_CONNECT_COL=13,
    // CI_RATE_COL=14, CI_LASTD_COL=17, CI_LASTO_COL=18 (all 0-indexed)
    return readSheet<ContactIntelRow>('Contact Intelligence!A:S', (r) => ({
      zohoLeadId:      r[0]  ?? '',
      zohoContactId:   r[1]  ?? '',
      zohoDealId:      r[2]  ?? '',
      name:            r[3]  ?? '',
      email:           r[4]  ?? '',
      phone:           r[5]  ?? '',
      title:           r[6]  ?? '',
      company:         r[7]  ?? '',
      l1Source:        r[8]  ?? '',
      l2Source:        r[9]  ?? '',
      sdr:             r[10] ?? '',
      totalCalls:      parseInt(r[12] ?? '0', 10) || 0,   // col M
      connectedCalls:  parseInt(r[13] ?? '0', 10) || 0,   // col N
      connectionRate:  parseInt(r[14] ?? '0', 10) || 0,   // col O
      lastCallDate:    r[17] ?? '',                        // col R
      lastCallOutcome: r[18] ?? '',                        // col S
      zohoStage:       r[16] ?? '',                        // col Q
    }))
  } catch { return [] }
}

// ── Payments — status update ──────────────────────────────────────────────────

export async function updateProspectCallStatus(email: string, status: string): Promise<void> {
  if (!email) return
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Prospects!A:L',
  })
  const rows = res.data.values ?? []
  const rowIdx = rows.findIndex((r, i) => i > 0 && (r[1] ?? '').toLowerCase() === email.toLowerCase())
  if (rowIdx === -1) return
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Prospects!L${rowIdx + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[status]] },
  })
}

export async function appendPaymentRowRaw(row: {
  date: string
  account: string
  deal: string
  amount: number
  invoiceDate: string
  dueDate: string
  status: Payment['status']
  notes: string
  attachmentUrl?: string
}): Promise<void> {
  const sheets = getSheets()
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const tabExists = meta.data.sheets?.some(s => (s.properties?.title ?? '') === 'Payments')
  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Payments' } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Payments!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [PAYMENTS_HEADERS] },
    })
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Payments!A:I',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[row.date, row.account, row.deal, row.amount, row.invoiceDate, row.dueDate, row.status, row.notes, row.attachmentUrl ?? '']],
    },
  })
}

export async function updatePaymentStatus(rowIndex: number, status: Payment['status']): Promise<void> {
  const sheets = getSheets()
  // rowIndex is 1-indexed sheet row (including header); data rows start at 2
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Payments!G${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[status]] },
  })
}

// ── Lost Deals sheet ─────────────────────────────────────────────────────────
// Columns: DealID | DealName | Account | ContactEmail | Category | DateMoved | Notes

export type LostDealCategory = 'No Shows / Multiple Reschedules' | 'Meeting Rescheduled-Cancelled' | 'Dropped 2025-26' | 'Lost'

export interface LostDeal {
  rowIndex: number
  dealId: string
  dealName: string
  account: string
  contactEmail: string
  category: LostDealCategory
  dateMoved: string
  notes: string
}

const LOST_DEALS_HEADERS = ['DealID', 'DealName', 'Account', 'ContactEmail', 'Category', 'DateMoved', 'Notes']

async function ensureLostDealsTab(sheets: ReturnType<typeof getSheets>) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const exists = meta.data.sheets?.some(s => s.properties?.title === 'Lost Deals')
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Lost Deals' } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Lost Deals!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [LOST_DEALS_HEADERS] },
    })
  }
}

export async function getLostDeals(): Promise<LostDeal[]> {
  try {
    const sheets = getSheets()
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Lost Deals!A:G' })
    const rows = res.data.values ?? []
    return rows.slice(1)
      .map((r, i) => ({
        rowIndex: i + 2,
        dealId:       String(r[0] ?? ''),
        dealName:     String(r[1] ?? ''),
        account:      String(r[2] ?? ''),
        contactEmail: String(r[3] ?? ''),
        category:     (String(r[4] ?? '') as LostDealCategory) || 'Lost',
        dateMoved:    String(r[5] ?? ''),
        notes:        String(r[6] ?? ''),
      }))
      .filter(d => d.dealId)
  } catch { return [] }
}

export async function appendLostDeal(row: Omit<LostDeal, 'rowIndex'>): Promise<void> {
  const sheets = getSheets()
  await ensureLostDealsTab(sheets)
  const now = new Date()
  const dateMoved = row.dateMoved || new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Lost Deals!A:G',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[row.dealId, row.dealName, row.account, row.contactEmail, row.category, dateMoved, row.notes]],
    },
  })
}

export async function deleteLostDealRow(rowIndex: number): Promise<void> {
  const sheets = getSheets()
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: await getLostDealsSheetId(sheets),
            dimension: 'ROWS',
            startIndex: rowIndex - 1,
            endIndex: rowIndex,
          },
        },
      }],
    },
  })
}

async function getLostDealsSheetId(sheets: ReturnType<typeof getSheets>): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const sheet = meta.data.sheets?.find(s => s.properties?.title === 'Lost Deals')
  return sheet?.properties?.sheetId ?? 0
}

// ── Objectives sheet ──────────────────────────────────────────────────────────
// Columns: Period | Objective | Target | Current | Assigned To

export interface Objective {
  period: string
  objective: string
  target: number
  current: number
  assignedTo: string
}

export const OBJECTIVE_NAMES = [
  'Prospects Uploaded',
  'Calls Dialled',
  'L1 Meetings Conducted',
  'Deals Won',
  'Trainers Onboarded',
  'Revenue Invoiced (₹K)',
  'Topic Coverage (%)',
] as const

const OBJECTIVE_ASSIGNEES: Record<string, string> = {
  'Prospects Uploaded':    'Ashutosh',
  'Calls Dialled':         'Tanishq',
  'L1 Meetings Conducted': 'Tanishq',
  'Deals Won':             'Anurag',
  'Trainers Onboarded':    'Ashutosh',
  'Revenue Invoiced (₹K)': 'Anurag',
  'Topic Coverage (%)':    'Ashutosh',
}

const OBJECTIVES_HEADERS = ['Period', 'Objective', 'Target', 'Current', 'Assigned To']

export async function getObjectives(period?: string): Promise<Objective[]> {
  try {
    const all = await readSheet<Objective>('Objectives!A:E', (r) => ({
      period:     r[0] ?? '',
      objective:  r[1] ?? '',
      target:     parseInt(r[2] ?? '0', 10) || 0,
      current:    parseInt(r[3] ?? '0', 10) || 0,
      assignedTo: r[4] ?? '',
    }))
    if (period) return all.filter(o => o.period === period)
    return all
  } catch { return [] }
}

// ── Manual Touchpoints sheet ─────────────────────────────────────────────────
// Columns A:F — Email | Date | Type | Notes | Logged By | Timestamp

export interface ManualTouchpoint {
  email:     string
  date:      string   // YYYY-MM-DD
  type:      'WhatsApp' | 'In-person'
  notes:     string
  loggedBy:  string
  timestamp: string
}

const MANUAL_TP_HEADERS = ['Email', 'Date', 'Type', 'Notes', 'Logged By', 'Timestamp']

export async function getManualTouchpoints(): Promise<ManualTouchpoint[]> {
  try {
    return readSheet<ManualTouchpoint>('Manual Touchpoints!A:F', (r) => ({
      email:     r[0] ?? '',
      date:      r[1] ?? '',
      type:      (r[2] as ManualTouchpoint['type']) ?? 'WhatsApp',
      notes:     r[3] ?? '',
      loggedBy:  r[4] ?? '',
      timestamp: r[5] ?? '',
    }))
  } catch { return [] }
}

export async function appendManualTouchpoint(
  email: string,
  date: string,
  type: 'WhatsApp' | 'In-person',
  notes: string,
  loggedBy: string
): Promise<void> {
  const sheets = getSheets()

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const tabExists = meta.data.sheets?.some(s => s.properties?.title === 'Manual Touchpoints')
  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Manual Touchpoints' } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Manual Touchpoints!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [MANUAL_TP_HEADERS] },
    })
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Manual Touchpoints!A:F',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[email, date, type, notes, loggedBy, istNowSheets()]],
    },
  })
}

export async function upsertObjective(
  period: string,
  objective: string,
  field: 'target' | 'current',
  value: number
): Promise<void> {
  const sheets = getSheets()

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const tabExists = meta.data.sheets?.some(s => s.properties?.title === 'Objectives')
  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Objectives' } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Objectives!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [OBJECTIVES_HEADERS] },
    })
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Objectives!A:E',
  })
  const rows = res.data.values ?? []
  const rowIdx = rows.findIndex((r, i) => i > 0 && r[0] === period && r[1] === objective)

  if (rowIdx !== -1) {
    const col = field === 'target' ? 'C' : 'D'
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Objectives!${col}${rowIdx + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[value]] },
    })
  } else {
    const target  = field === 'target'  ? value : 0
    const current = field === 'current' ? value : 0
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Objectives!A:E',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[period, objective, target, current, OBJECTIVE_ASSIGNEES[objective] ?? '']],
      },
    })
  }
}
