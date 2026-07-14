import { NextResponse } from 'next/server'
import { getRecentSyncErrorCount } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export async function GET() {
  const count = await getRecentSyncErrorCount(24)
  return NextResponse.json({ count })
}
