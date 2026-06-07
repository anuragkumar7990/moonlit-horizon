import { NextResponse } from 'next/server'
import { getProspects } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const prospects = await getProspects()

    const bySource = new Map<string, number>()
    for (const p of prospects) {
      const src = p.lvl1Source?.trim() || 'Unknown'
      bySource.set(src, (bySource.get(src) ?? 0) + 1)
    }

    const sourceBreakdown = Array.from(bySource.entries())
      .map(([source, count]) => ({
        source,
        count,
        weeksOfStock: Math.round((count / 250) * 10) / 10,
      }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json(
      {
        total: prospects.length,
        totalWeeksOfStock: Math.round((prospects.length / 250) * 10) / 10,
        bySource: sourceBreakdown,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=10800, stale-while-revalidate=60',
        },
      },
    )
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
