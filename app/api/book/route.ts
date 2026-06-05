import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createDeal } from '@/lib/zoho'
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      accountId: string
      accountName: string
      contactId: string
      contactName: string
      contactEmail: string
      meetingTime: string
      meetingType: 'L1' | 'L2+'
    }

    const { accountName, contactName, contactEmail, meetingTime, meetingType, accountId, contactId } = body

    const title = meetingType === 'L1'
      ? `${accountName} <> The Test Tribe | Upskilling for Teams`
      : `${accountName} <> The Test Tribe | Training - Next Steps`

    const startTime = new Date(meetingTime)
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000) // 30 minutes

    const auth = getGoogleAuth()
    const calendar = google.calendar({ version: 'v3', auth })
    const sheets = google.sheets({ version: 'v4', auth })

    // Create Google Calendar event with G-Meet
    const calEvent = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID ?? 'primary',
      conferenceDataVersion: 1,
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
        reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 30 }, { method: 'popup', minutes: 10 }] },
      },
    })

    const gMeetLink = calEvent.data.conferenceData?.entryPoints?.[0]?.uri ?? ''
    const meetingId = `MTG-${Date.now()}`

    // Create Zoho CRM Deal
    const closingDate = new Date(startTime.getTime() + 30 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0]
    let dealId = ''
    let dealError = ''
    try {
      dealId = await createDeal({
        accountId,
        contactId,
        dealName: title,
        stage: meetingType === 'L1' ? 'Discovery Call booked' : 'Outline Meeting Conducted',
        closingDate,
      })
    } catch (err) {
      dealError = String(err)
      console.error('[/api/book] Zoho deal creation failed:', err)
    }

    // Append to Google Sheets Meetings tab
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

    // Update Accounts tab last activity + stage
    // (Append if not present, update stage if present — simplified: always append)
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

    return NextResponse.json({ ok: true, meetingId, gMeetLink, dealId, dealError: dealError || undefined })
  } catch (err) {
    console.error('[/api/book]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
