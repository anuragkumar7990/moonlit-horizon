import { NextRequest, NextResponse } from 'next/server'
import { getTasks, updateTaskStatus, patchTask } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') // 'P0' | 'Objective' | null = all
  const tasks = await getTasks()
  const filtered = type ? tasks.filter(t => t.type === type) : tasks
  const sorted = filtered.sort((a, b) => b.date.localeCompare(a.date) || b.task.localeCompare(a.task))
  return NextResponse.json({ tasks: sorted })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json() as { linkedDeal?: string; status?: string; task?: string; assignedTo?: string }
  if (!body.linkedDeal) return NextResponse.json({ error: 'linkedDeal is required' }, { status: 400 })

  // Status update (Mark Done / Reopen)
  if (body.status) {
    await updateTaskStatus(body.linkedDeal, body.status as 'Done' | 'Open')
  }
  // Field edits (task text, assignedTo)
  if (body.task !== undefined || body.assignedTo !== undefined) {
    await patchTask(body.linkedDeal, { task: body.task, assignedTo: body.assignedTo })
  }
  return NextResponse.json({ ok: true })
}
