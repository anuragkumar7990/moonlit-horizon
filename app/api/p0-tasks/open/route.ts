import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import { getTasks } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export async function GET() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const all = await getTasks()
  const open = all
    .filter(t => t.date === today && t.type === 'P0' && t.status !== 'Done')
    .map(t => ({ linkedDeal: t.linkedDeal, task: t.task, assignedTo: t.assignedTo }))
  return NextResponse.json({ tasks: open })
}
