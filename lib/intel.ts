import Anthropic from '@anthropic-ai/sdk'
import {
  upsertAccountIntelligence,
  updateEmailIntelligence,
  updateCumulativeInSheet,
  getAccountIntelligence,
  getCalls,
  type AccountIntelligence,
} from './sheets'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface MeetingInput {
  date: string
  notes: string
}

export interface EmailThread {
  date: string
  subject: string
  snippet: string
}

function istNow(): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  return `${ist.toISOString().slice(0, 10)} ${ist.toISOString().slice(11, 16)}`
}

function norm(s: string) {
  return s.toLowerCase().trim()
}

async function callHaiku(prompt: string, maxTokens = 300): Promise<string> {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  })
  return (message.content[0] as { text: string }).text.trim()
}

// ── Per-layer generators ─────────────────────────────────────────────────────

export async function generateCirclebakIntel(account: string, meetings: MeetingInput[]): Promise<string> {
  if (meetings.length === 0) return ''
  const sorted = [...meetings].sort((a, b) => a.date.localeCompare(b.date))
  const notesBlock = sorted.map((m, i) => `=== Meeting ${i + 1} (${m.date}) ===\n${m.notes}`).join('\n\n')

  const prompt = `You are a sales intelligence assistant for The Test Tribe, a corporate AI training company in India.

Client: ${account}
Meeting count: ${meetings.length}

Meeting notes (oldest first):
${notesBlock}

Write a 2–3 sentence Circleback intelligence brief covering: what the client needs, team context, where the deal stands, and key blockers — based solely on these meeting notes. Be specific and factual. No NEXT ACTION or STATUS fields.`

  return callHaiku(prompt, 200)
}

export async function generateCallIntel(account: string, calls: { date: string; outcome: string; notes: string; duration?: string }[]): Promise<string> {
  if (calls.length === 0) return ''
  const sorted = [...calls].sort((a, b) => a.date.localeCompare(b.date))
  const callBlock = sorted
    .map(c => `${c.date} | ${c.outcome}${c.duration ? ` (${c.duration})` : ''}${c.notes ? ' — ' + c.notes : ''}`)
    .join('\n')

  const prompt = `You are a sales intelligence assistant for The Test Tribe, a corporate AI training company in India.

Client: ${account}
Total calls: ${calls.length}

Call log (oldest first):
${callBlock}

Write a 2–3 sentence call intelligence brief covering: call frequency, connection rate, notable conversations, and what was learned from calling this account. Be specific and factual.`

  return callHaiku(prompt, 200)
}

export async function generateEmailIntel(account: string, threads: EmailThread[]): Promise<string> {
  if (threads.length === 0) return ''
  const sorted = [...threads].sort((a, b) => a.date.localeCompare(b.date))
  const threadBlock = sorted
    .map(t => `${t.date} | ${t.subject}\n${t.snippet}`)
    .join('\n\n')

  const prompt = `You are a sales intelligence assistant for The Test Tribe, a corporate AI training company in India.

Client: ${account}
Email threads: ${threads.length}

Email history (oldest first):
${threadBlock}

Reply in this exact format — nothing else:

<2 sentences: overall communication summary — tone, frequency, where things stand>

1. YYYY-MM-DD >> <7–8 word summary of this thread>
2. YYYY-MM-DD >> <7–8 word summary of this thread>
(one line per thread, oldest first)`

  return callHaiku(prompt, 400)
}

// ── Cumulative synthesis ─────────────────────────────────────────────────────

interface CumulativeResult {
  cumulativeSummary: string
  nextAction: string
  status: AccountIntelligence['status']
}

interface IntelLayers {
  emailIntelligence: string
  circlebakIntelligence: string
  callIntelligence: string
  manualNotes: string
}

async function generateCumulativeWithStatus(account: string, layers: IntelLayers): Promise<CumulativeResult> {
  const parts: string[] = []
  if (layers.emailIntelligence)     parts.push(`EMAIL:\n${layers.emailIntelligence}`)
  if (layers.circlebakIntelligence) parts.push(`MEETINGS (Circleback):\n${layers.circlebakIntelligence}`)
  if (layers.callIntelligence)      parts.push(`CALLS:\n${layers.callIntelligence}`)
  if (layers.manualNotes)           parts.push(`MANUAL NOTES:\n${layers.manualNotes}`)

  if (parts.length === 0) {
    return { cumulativeSummary: '', nextAction: '', status: 'Cold' }
  }

  const prompt = `You are a sales intelligence assistant for The Test Tribe, a corporate AI training company in India. We sell live, trainer-led AI/Agentic AI upskilling programs (10–20 hours, ₹1.3L–₹4L+) to QA and engineering teams.

Client: ${account}

Intelligence layers:
${parts.join('\n\n')}

Reply with ONLY these three lines and nothing else — no preamble, no notes, no extra text:

SUMMARY: <2–3 sentences synthesising all data — deal status, key insight, blockers>
NEXT ACTION: <one specific action, max 15 words>
STATUS: <exactly one of: Won | Active | Warm | Cold | Dead>

Status definitions: Won=training delivered; Active=pricing/scheduling agreed; Warm=interested+following up; Cold=blocked by budget/approval; Dead=no fit or ghosted`

  const text = await callHaiku(prompt, 250)

  const summaryMatch    = text.match(/SUMMARY:\s*([\s\S]+?)(?=\nNEXT ACTION:)/)
  const nextActionMatch = text.match(/NEXT ACTION:\s*([\s\S]+?)(?=\nSTATUS:)/)
  const statusMatch     = text.match(/STATUS:\s*(Won|Active|Warm|Cold|Dead)/i)

  // If LLM skipped the SUMMARY: label entirely, treat the whole first paragraph as summary
  const rawSummary = summaryMatch?.[1]?.trim()
    ?? text.split(/\n+(NEXT ACTION|STATUS):/i)[0].replace(/^SUMMARY:\s*/i, '').trim()

  return {
    cumulativeSummary: rawSummary,
    nextAction:        nextActionMatch?.[1]?.trim() ?? '',
    status:            (statusMatch?.[1] as AccountIntelligence['status']) ?? 'Cold',
  }
}

// ── Public: full rebuild ─────────────────────────────────────────────────────

export async function generateAndSaveIntel(
  account: string,
  meetings: MeetingInput[]
): Promise<AccountIntelligence> {
  const sorted      = [...meetings].sort((a, b) => a.date.localeCompare(b.date))
  const lastMeeting = sorted[sorted.length - 1]?.date ?? ''

  // Preserve existing email intelligence + manual notes
  const allExisting      = await getAccountIntelligence()
  const existing         = allExisting.find(i => norm(i.account) === norm(account))
  const emailIntelligence = existing?.emailIntelligence ?? ''
  const manualNotes       = existing?.manualNotes ?? ''

  // Generate Circleback intelligence
  const circlebakIntelligence = await generateCirclebakIntel(account, sorted)

  // Generate Call intelligence from Calls sheet
  const allCalls     = await getCalls()
  const accountCalls = allCalls.filter(c => norm(c.account) === norm(account))
  const callIntelligence = accountCalls.length > 0
    ? await generateCallIntel(account, accountCalls.map(c => ({ date: c.date, outcome: c.outcome, notes: c.notes, duration: c.duration })))
    : (existing?.callIntelligence ?? '')

  // Generate cumulative summary
  const { cumulativeSummary, nextAction, status } = await generateCumulativeWithStatus(account, {
    emailIntelligence,
    circlebakIntelligence,
    callIntelligence,
    manualNotes,
  })

  const intel: AccountIntelligence = {
    account,
    updatedAt: istNow(),
    meetingCount: meetings.length,
    lastMeeting,
    status,
    emailIntelligence,
    circlebakIntelligence,
    callIntelligence,
    manualNotes,
    cumulativeSummary,
    nextAction,
  }

  await upsertAccountIntelligence(intel)
  return intel
}

// ── Public: regenerate cumulative only (after note/email sync) ───────────────

export async function regenerateCumulative(
  account: string
): Promise<{ cumulativeSummary: string; nextAction: string }> {
  const allIntel = await getAccountIntelligence()
  const intel    = allIntel.find(i => norm(i.account) === norm(account))
  if (!intel) throw new Error(`Account not found in Account Intelligence: ${account}`)

  const { cumulativeSummary, nextAction } = await generateCumulativeWithStatus(account, {
    emailIntelligence:     intel.emailIntelligence,
    circlebakIntelligence: intel.circlebakIntelligence,
    callIntelligence:      intel.callIntelligence,
    manualNotes:           intel.manualNotes,
  })

  await updateCumulativeInSheet(account, cumulativeSummary, nextAction)
  return { cumulativeSummary, nextAction }
}

// ── Public: sync email intel for one account ─────────────────────────────────

export async function syncEmailIntel(account: string, threads: EmailThread[]): Promise<{ cumulativeSummary: string; nextAction: string }> {
  const emailIntelligence = await generateEmailIntel(account, threads)
  await updateEmailIntelligence(account, emailIntelligence)
  return regenerateCumulative(account)
}
