import { NextRequest, NextResponse } from 'next/server'
import { getTasks, updateTaskStatus } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') // 'P0' | 'Objective' | null = all
  const tasks = await getTasks()
  const filtered = type ? tasks.filter(t => t.type === type) : tasks
  const sorted = filtered.sort((a, b) => b.date.localeCompare(a.date) || b.task.localeCompare(a.task))
  return NextResponse.json({ tasks: sorted })
}

export async function PATCH(req: NextRequest) {
  const { linkedDeal, status } = await req.json() as { linkedDeal?: string; status?: string }
  if (!linkedDeal || !status) {
    return NextResponse.json({ error: 'linkedDeal and status are required' }, { status: 400 })
  }
  await updateTaskStatus(linkedDeal, status as 'Done' | 'Open')
  return NextResponse.json({ ok: true })
}
