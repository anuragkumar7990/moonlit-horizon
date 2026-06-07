import { NextResponse } from 'next/server'
import { getTrainerPipeline, getTrainerRoster, getTopicCoverage } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [pipeline, roster, coverage] = await Promise.all([
      getTrainerPipeline(),
      getTrainerRoster(),
      getTopicCoverage(),
    ])

    return NextResponse.json(
      { pipeline, roster, coverage, fetchedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, max-age=1800, stale-while-revalidate=60' } },
    )
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
