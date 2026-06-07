import { NextResponse } from 'next/server'
import { getProspects } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const prospects = await getProspects()

    const bySource = new Map<string, number>()
    const byL2Source = new Map<string, number>()
    const byL1L2 = new Map<string, Map<string, number>>()

    for (const p of prospects) {
      const src = p.lvl1Source?.trim() || 'Unknown'
      const l2 = p.lvl2Source?.trim() || 'Unknown'
      bySource.set(src, (bySource.get(src) ?? 0) + 1)
      byL2Source.set(l2, (byL2Source.get(l2) ?? 0) + 1)
      if (!byL1L2.has(src)) byL1L2.set(src, new Map())
      const l2Map = byL1L2.get(src)!
      l2Map.set(l2, (l2Map.get(l2) ?? 0) + 1)
    }

    const sourceBreakdown = Array.from(bySource.entries())
      .map(([source, count]) => ({
        source,
        count,
        weeksOfStock: Math.round((count / 250) * 10) / 10,
        l2Breakdown: Array.from((byL1L2.get(source) ?? new Map()).entries())
          .map(([l2, c]) => ({ source: l2, count: c }))
          .sort((a, b) => b.count - a.count),
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
