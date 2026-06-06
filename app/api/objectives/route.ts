import { NextRequest, NextResponse } from 'next/server'
import { getObjectives, upsertObjective } from '@/lib/sheets'

function currentPeriod(): string {
  const now = new Date()
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
  return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}`
}

export async function GET() {
  try {
    const period = currentPeriod()
    const objectives = await getObjectives(period)
    return NextResponse.json({ period, objectives })
  } catch (err) {
    console.error('[objectives GET]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      objective: string
      field: 'target' | 'current'
      value: number
      period?: string
    }
    const { objective, field, value } = body
    if (!objective || !field || value == null) {
      return NextResponse.json({ error: 'objective, field, and value are required' }, { status: 400 })
    }
    if (field !== 'target' && field !== 'current') {
      return NextResponse.json({ error: "field must be 'target' or 'current'" }, { status: 400 })
    }
    const period = body.period ?? currentPeriod()
    await upsertObjective(period, objective, field, Number(value))
    return NextResponse.json({ ok: true, period, objective, field, value })
  } catch (err) {
    console.error('[objectives POST]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
