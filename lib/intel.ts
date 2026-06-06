import Anthropic from '@anthropic-ai/sdk'
import { upsertAccountIntelligence, type AccountIntelligence } from './sheets'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface MeetingInput {
  date: string
  notes: string
}

function istNow(): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  return `${ist.toISOString().slice(0, 10)} ${ist.toISOString().slice(11, 16)}`
}

export async function generateAndSaveIntel(
  account: string,
  meetings: MeetingInput[]
): Promise<AccountIntelligence> {
  const sorted = [...meetings].sort((a, b) => a.date.localeCompare(b.date))
  const lastMeeting = sorted[sorted.length - 1]?.date ?? ''

  const notesBlock = sorted
    .map((m, i) => `=== Meeting ${i + 1} (${m.date}) ===\n${m.notes}`)
    .join('\n\n')

  const prompt = `You are a sales intelligence assistant for The Test Tribe, a corporate AI training company in India. We sell live, trainer-led AI/Agentic AI upskilling programs (10–20 hours, ₹1.3L–₹4L+) to QA and engineering teams at tech companies.

Client: ${account}
Total meetings: ${meetings.length}

Meeting history (oldest first):
${notesBlock}

Write a concise account intelligence brief in exactly this format:

SUMMARY: [2–3 sentences covering: what they need, team context, where they are in the deal, key blockers]

NEXT ACTION: [One clear action sentence, max 15 words]

STATUS: [exactly one of: Won, Active, Warm, Cold, Dead]
- Won = training delivered or actively underway
- Active = pricing/scheduling agreed, deal closing
- Warm = genuinely interested, proposal shared, follow-ups happening
- Cold = interested but blocked by budget/approval/timing (months away)
- Dead = no fit, explicitly declined, or ghosted with no path forward`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (message.content[0] as { text: string }).text.trim()

  const summaryMatch = text.match(/SUMMARY:\s*([\s\S]+?)(?=\n\nNEXT ACTION:|$)/)
  const nextActionMatch = text.match(/NEXT ACTION:\s*([\s\S]+?)(?=\n\nSTATUS:|$)/)
  const statusMatch = text.match(/STATUS:\s*(Won|Active|Warm|Cold|Dead)/i)

  const summary    = summaryMatch?.[1]?.trim()    ?? text
  const nextAction = nextActionMatch?.[1]?.trim() ?? ''
  const status     = (statusMatch?.[1] as AccountIntelligence['status']) ?? 'Cold'

  const intel: AccountIntelligence = {
    account,
    updatedAt: istNow(),
    meetingCount: meetings.length,
    lastMeeting,
    status,
    summary,
    nextAction,
  }

  await upsertAccountIntelligence(intel)
  return intel
}
