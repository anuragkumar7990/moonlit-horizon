import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { randomUUID } from 'crypto'

const SECRET = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'

// TTT internal emails always added to training invites
const TTT_TRAINING_ATTENDEES = [
  'trainings@thetesttribe.com',
  'anurag@thetesttribe.com',
]

interface TrainingSession {
  sessionNumber: number
  date: string      // YYYY-MM-DD
  startTime: string // HH:MM (24h IST)
  endTime: string   // HH:MM (24h IST)
}

interface ScheduleRequest {
  trainingName: string
  clientName: string
  trainerEmail: string
  attendeeEmails: string[]
  sessions: TrainingSession[]
  note?: string
}

function getGoogleAuth() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return oauth2
}

function buildISTDateTime(date: string, time: string): string {
  // date: YYYY-MM-DD, time: HH:MM → ISO string with IST offset
  return `${date}T${time}:00+05:30`
}

export async function POST(req: NextRequest) {
  const pwd = req.headers.get('x-dashboard-password') ?? req.nextUrl.searchParams.get('password')
  if (pwd !== SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ScheduleRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { trainingName, clientName, trainerEmail, attendeeEmails, sessions, note } = body

  if (!trainingName || !clientName || !trainerEmail || !sessions?.length) {
    return NextResponse.json(
      { error: 'Required fields: trainingName, clientName, trainerEmail, sessions' },
      { status: 400 }
    )
  }

  const auth = getGoogleAuth()
  const calendar = google.calendar({ version: 'v3', auth })
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? 'primary'

  const allAttendees = [
    trainerEmail,
    ...attendeeEmails,
    ...TTT_TRAINING_ATTENDEES,
  ].filter((v, i, a) => a.indexOf(v) === i) // deduplicate

  const defaultNote = `Dear Team,

Please find your calendar invite for the upcoming training session. Kindly join on time and keep your camera on.

For any queries, reach out to trainings@thetesttribe.com

Looking forward to a productive session!

Warm regards,
The Test Tribe Corporate Training Team`

  const description = note || defaultNote

  const created: Array<{
    sessionNumber: number
    eventId: string
    gMeetLink: string
    htmlLink: string
  }> = []

  for (const session of sessions) {
    const { sessionNumber, date, startTime, endTime } = session

    const title = `${clientName} | Session ${sessionNumber} | ${trainingName} | The Test Tribe`
    const startISO = buildISTDateTime(date, startTime)
    const endISO = buildISTDateTime(date, endTime)

    try {
      const event = await calendar.events.insert({
        calendarId,
        conferenceDataVersion: 1,
        sendUpdates: 'all',
        requestBody: {
          summary: title,
          description,
          start: { dateTime: startISO, timeZone: 'Asia/Kolkata' },
          end: { dateTime: endISO, timeZone: 'Asia/Kolkata' },
          attendees: allAttendees.map(email => ({ email })),
          conferenceData: {
            createRequest: {
              requestId: randomUUID(),
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
          guestsCanModify: false,
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 24 * 60 }, // 1 day before
              { method: 'email', minutes: 60 },       // 1 hour before
              { method: 'popup', minutes: 15 },
            ],
          },
        },
      })

      const entryPoints = event.data.conferenceData?.entryPoints ?? []
      const meetEntry = entryPoints.find(ep => ep.entryPointType === 'video')

      created.push({
        sessionNumber,
        eventId: event.data.id ?? '',
        gMeetLink: meetEntry?.uri ?? '',
        htmlLink: event.data.htmlLink ?? '',
      })
    } catch (err) {
      console.error(`[training/schedule] Failed to create Session ${sessionNumber}:`, err)
      return NextResponse.json(
        { error: `Failed to create event for Session ${sessionNumber}: ${String(err)}`, created },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ ok: true, created })
}
