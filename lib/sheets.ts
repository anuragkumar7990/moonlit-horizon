import { google } from 'googleapis'
import type { Meeting, Note, Communication, Account } from './types'

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
  return readSheet<Note>('Notes!A:E', (r) => ({
    meetingId: r[0] ?? '',
    accountName: r[1] ?? '',
    summary: r[2] ?? '',
    actionables: r[3] ?? '',
    createdAt: r[4] ?? '',
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
