import { google } from 'googleapis'
import { createDeal, findDealIdByName } from './zoho'
import { randomUUID } from 'crypto'

const TTT_ATTENDEES = [
  'tanishq@thetesttribe.com',
  'anurag@thetesttribe.com',
  'trainings@thetesttribe.com',
  'ashutosh@thetesttribe.com',
]

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!

function getGoogleAuth() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return oauth2
}

export async function bookMeeting(payload: {
  accountId: string
  accountName: string
  contactName: string
  contactEmail: string
  contactPhone?: string
  meetingTime: string
  meetingType: 'L1' | 'L2+'
}): Promise<{
  meetingId: string
  gMeetLink: string
  dealId: string
  dealError?: string
}> {
  const { accountId, accountName, contactName, contactEmail, contactPhone = '', meetingTime, meetingType } = payload

  const title = meetingType === 'L1'
    ? `${accountName} <> The Test Tribe | Upskilling for Teams`
    : `${accountName} <> The Test Tribe | Training - Next Steps`

  const startTime = new Date(meetingTime)
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000)

  const auth = getGoogleAuth()
  const calendar = google.calendar({ version: 'v3', auth })
  const sheets = google.sheets({ version: 'v4', auth })

  const calEvent = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID ?? 'primary',
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: {
      summary: title,
      start: { dateTime: startTime.toISOString(), timeZone: 'Asia/Kolkata' },
      end: { dateTime: endTime.toISOString(), timeZone: 'Asia/Kolkata' },
      attendees: [
        { email: contactEmail },
        ...TTT_ATTENDEES.map(email => ({ email })),
      ],
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      guestsCanModify: false,
      reminders: {
        useDefault: false,
        overrides: [{ method: 'email', minutes: 30 }, { method: 'popup', minutes: 10 }],
      },
    },
  })

  const gMeetLink = calEvent.data.conferenceData?.entryPoints?.[0]?.uri ?? ''
  const meetingId = `MTG-${Date.now()}`

  const closingDate = new Date(startTime.getTime() + 30 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]

  let dealId = ''
  let dealError: string | undefined

  try {
    const existingDealId = await findDealIdByName(accountName)
    if (existingDealId) {
      dealId = existingDealId
      console.log(`[bookMeeting] Reusing existing deal ${existingDealId} for ${accountName}`)
    } else {
      dealId = await createDeal({
        accountId,
        accountName,
        contactName,
        contactEmail,
        contactPhone,
        stage: meetingType === 'L1' ? 'Discovery Call booked' : 'Outline Meeting Conducted',
        closingDate,
        dateOfFirstContact: startTime.toISOString().split('T')[0],
      })
    }
  } catch (err) {
    dealError = String(err)
    console.error('[bookMeeting] Zoho deal creation failed:', err)
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Meetings!A:J',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        meetingId,
        accountName,
        contactName,
        contactEmail,
        startTime.toISOString(),
        meetingType,
        gMeetLink,
        dealId,
        'Meeting Booked',
        new Date().toISOString(),
      ]],
    },
  })

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Accounts!A:E',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        accountName,
        contactName,
        contactEmail,
        'Meeting Booked',
        new Date().toISOString().split('T')[0],
      ]],
    },
  })

  return { meetingId, gMeetLink, dealId, dealError }
}

export interface CalendarEvent {
  id: string
  title: string
  startTime: string      // ISO datetime
  endTime: string
  gMeetLink: string | null
  attendeeEmails: string[]
}

export async function getCalendarEvents(istDateFrom: string, istDateTo?: string): Promise<CalendarEvent[]> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID
  if (!calendarId) return []

  const auth = getGoogleAuth()
  const calendar = google.calendar({ version: 'v3', auth })

  const timeMin = new Date(`${istDateFrom}T00:00:00+05:30`).toISOString()
  const endDate  = istDateTo ?? istDateFrom
  const timeMax  = new Date(`${endDate}T23:59:59+05:30`).toISOString()

  const res = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  })

  return (res.data.items ?? [])
    .filter(e => e.status !== 'cancelled')
    .map(e => {
      const entryPoints = e.conferenceData?.entryPoints ?? []
      const meetEntry = entryPoints.find(ep => ep.entryPointType === 'video')
      return {
        id:             e.id ?? '',
        title:          e.summary ?? '',
        startTime:      e.start?.dateTime ?? e.start?.date ?? '',
        endTime:        e.end?.dateTime ?? e.end?.date ?? '',
        gMeetLink:      meetEntry?.uri ?? null,
        attendeeEmails: (e.attendees ?? []).map(a => a.email ?? '').filter(Boolean),
      }
    })
}
