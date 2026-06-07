import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

const TRAINER_OUTREACH_SHEET_ID = '1Xol3kb_5GDxS-Su-fAs1tIvTSLfGahNXWHv0MKUOY9I'
const TRAINER_SUPPLY_SHEET_ID   = '1R8FqcifveekYZsaS3taHARaQAo3CjZ0FqdHnNOcZg2U'

function getSheets() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return google.sheets({ version: 'v4', auth: oauth2 })
}

async function readRaw(spreadsheetId: string, range: string): Promise<string[][]> {
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })
  return (res.data.values ?? []).map(r => r.map((c: unknown) => String(c ?? '').trim()))
}

function cell(row: string[], idx: number): string {
  return (row[idx] ?? '').trim()
}

// ── Sheet A: Google Form responses ───────────────────────────────────────────
// Col: 0=Timestamp, 1=Full Name, 2=Email, 3=Phone, 4=Location,
//      5=LinkedIn, 6=Website, 7=Expertise Areas, 8=Signature Topic,
//      9=Target Audience, 10=Certifications, 11=Years Experience

export interface TrainerApplication {
  name: string
  email: string
  phone: string
  location: string
  linkedin: string
  expertiseAreas: string[]
  signatureTopic: string
  targetAudience: string[]
  certifications: string
  experienceYears: string
  submittedAt: string
}

function parseApplications(rows: string[][]): TrainerApplication[] {
  const TEST_SIGNALS = ['test@', '@123', 'test2', 'dummy']
  const isTest = (email: string, name: string) =>
    TEST_SIGNALS.some(s => email.toLowerCase().includes(s) || name.toLowerCase() === 'test2')

  const apps: TrainerApplication[] = []
  for (const row of rows.slice(1)) {
    const ts   = cell(row, 0)
    const name = cell(row, 1)
    const email = cell(row, 2)
    if (!ts || !name || isTest(email, name)) continue
    apps.push({
      name,
      email,
      phone:          cell(row, 3),
      location:       cell(row, 4),
      linkedin:       cell(row, 5),
      expertiseAreas: cell(row, 7).split(',').map(s => s.trim()).filter(Boolean),
      signatureTopic: cell(row, 8),
      targetAudience: cell(row, 9).split(',').map(s => s.trim()).filter(Boolean),
      certifications: cell(row, 10),
      experienceYears: cell(row, 11),
      submittedAt:    ts,
    })
  }
  return apps
}

// ── Sheet B: Roster + Topic Coverage ─────────────────────────────────────────

export interface RosterEntry {
  name: string
  profileDetails: string
  tier: string
  score: number
  hourlyRate: string
}

export interface CoverageEntry {
  topic: string
  hourlyCharge: string
  dailyCharge: string
  trainers: string[]
}

function parseSheetB(rows: string[][]): { roster: RosterEntry[]; coverage: CoverageEntry[] } {
  const roster: RosterEntry[] = []
  const coverage: CoverageEntry[] = []

  // Find trainer roster header: "Trainer Name" in col0, "Tier" in col2
  let rosterStart = -1
  for (let i = 0; i < rows.length; i++) {
    if (cell(rows[i], 0) === 'Trainer Name' && cell(rows[i], 2) === 'Tier') {
      rosterStart = i + 1
      break
    }
  }

  if (rosterStart !== -1) {
    for (let i = rosterStart; i < rows.length; i++) {
      const name = cell(rows[i], 0)
      if (!name) continue              // skip empty rows — don't break
      if (name === 'Trainer Name') break // next section header
      const tier = cell(rows[i], 2)
      if (!['Tier-1', 'Tier-2', 'Tier-3'].includes(tier)) {
        // If we see two consecutive non-trainer rows, assume section ended
        if (i > rosterStart && !cell(rows[i - 1], 0)) break
        continue
      }
      roster.push({
        name,
        profileDetails: cell(rows[i], 1),
        tier,
        score:       parseInt(cell(rows[i], 3), 10) || 0,
        hourlyRate:  cell(rows[i], 4),
      })
    }
  }

  // Find pricing table header: "Topic" in col0, "Hourly Charge to Customer" in col1
  let priceStart = -1
  for (let i = 0; i < rows.length; i++) {
    if (cell(rows[i], 0) === 'Topic' && cell(rows[i], 1).toLowerCase().includes('hourly')) {
      priceStart = i + 1
      break
    }
  }

  if (priceStart !== -1) {
    for (let i = priceStart; i < rows.length; i++) {
      const topic = cell(rows[i], 0)
      if (!topic) continue
      if (topic === 'Topic') break
      const hourly = cell(rows[i], 1)
      const daily  = cell(rows[i], 2)
      if (!hourly && !daily) continue
      // Trainers who cover this topic: try to extract from remaining columns
      const trainers = rows[i].slice(4).filter(Boolean)
      coverage.push({ topic, hourlyCharge: hourly, dailyCharge: daily, trainers })
    }
  }

  return { roster, coverage }
}

export async function GET() {
  try {
    const [rowsA, rowsB] = await Promise.all([
      readRaw(TRAINER_OUTREACH_SHEET_ID, 'A:L'),
      readRaw(TRAINER_SUPPLY_SHEET_ID, 'A:L'),
    ])

    const applications = parseApplications(rowsA)

    // Expertise area breakdown
    const expertiseCounts = new Map<string, number>()
    for (const app of applications) {
      for (const area of app.expertiseAreas) {
        if (area) expertiseCounts.set(area, (expertiseCounts.get(area) ?? 0) + 1)
      }
    }
    const expertiseBreakdown = Array.from(expertiseCounts.entries())
      .map(([area, count]) => ({ area, count }))
      .sort((a, b) => b.count - a.count)

    const { roster, coverage } = parseSheetB(rowsB)

    return NextResponse.json({
      pipeline: {
        totalApplications: applications.length,
        expertiseBreakdown,
        recentApplications: applications.slice(-10).reverse(),
      },
      roster,
      coverage,
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
