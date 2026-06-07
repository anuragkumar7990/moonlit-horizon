import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAccountIntelligence } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface DraftEmailRequest {
  accountName: string
  contactName: string
  contactEmail?: string
  sdrName: string
  meetingDate?: string
  meetingTime?: string
  meetingType?: string
  // New: specific insight bullets to weave in (preferred over raw intel keys)
  selectedInsights?: string[]
  // Legacy: raw intel layer keys (fallback if no selectedInsights)
  selectedIntelKeys?: string[]
  additionalContext?: string
}

export interface DraftEmailResponse {
  subject: string
  body: string
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json() as DraftEmailRequest
    const {
      accountName, contactName, sdrName,
      meetingDate, meetingTime, meetingType,
      selectedInsights, selectedIntelKeys,
      additionalContext,
    } = payload

    if (!accountName || !contactName || !sdrName) {
      return NextResponse.json({ error: 'accountName, contactName and sdrName are required' }, { status: 400 })
    }

    const meetingDetails = [
      meetingType ? `Meeting type: ${meetingType === 'L1' ? 'L1 (Discovery Call)' : 'L2+ (Proposal / Deep-dive)'}` : '',
      meetingDate ? `Date: ${meetingDate}` : '',
      meetingTime ? `Time: ${meetingTime}` : '',
    ].filter(Boolean).join('\n')

    let intelContext: string

    // Prefer selectedInsights (specific bullet points) over raw intel keys
    if (selectedInsights && selectedInsights.length > 0) {
      intelContext = `## Key Intel Bullets\n${selectedInsights.map(p => `• ${p}`).join('\n')}`
    } else if (selectedIntelKeys && selectedIntelKeys.length > 0) {
      // Legacy: fetch account intel and filter by keys
      const allIntel = await getAccountIntelligence()
      const intel = allIntel.find(i => i.account.toLowerCase() === accountName.toLowerCase())
      const parts: string[] = []
      if (intel) {
        if (selectedIntelKeys.includes('cumulative')  && intel.cumulativeSummary)    parts.push(`## Cumulative Summary\n${intel.cumulativeSummary}`)
        if (selectedIntelKeys.includes('email')        && intel.emailIntelligence)    parts.push(`## Email Intelligence\n${intel.emailIntelligence}`)
        if (selectedIntelKeys.includes('call')         && intel.callIntelligence)     parts.push(`## Call Intelligence\n${intel.callIntelligence}`)
        if (selectedIntelKeys.includes('circleback')   && intel.circlebakIntelligence) parts.push(`## Meeting Notes\n${intel.circlebakIntelligence}`)
        if (selectedIntelKeys.includes('manual')       && intel.manualNotes)          parts.push(`## Manual Notes\n${intel.manualNotes}`)
      }
      intelContext = parts.length > 0 ? parts.join('\n\n') : 'No prior intelligence available.'
    } else {
      intelContext = 'No prior intelligence available.'
    }

    const prompt = `You are a business development representative at The Test Tribe, a corporate training company specialising in QA, AI/automation, and software testing upskilling.

You are writing a pre-meeting email to ${contactName} at ${accountName} before their upcoming training discussion.

## Meeting Details
${meetingDetails || 'Meeting details not specified.'}

## Prior Account Intelligence
${intelContext}
${additionalContext ? `\n## Additional Context\n${additionalContext}` : ''}

## Instructions
Write a warm, professional, concise pre-meeting email from ${sdrName} at The Test Tribe.

- Subject line should be specific and reference the company / meeting type
- Opening: greet ${contactName} by name and reference the upcoming meeting
- Middle: weave in 2–3 relevant points from the intelligence above to show preparation — keep it natural, not a data dump
- Close: clear agenda confirmation or what we plan to cover
- Sign off as ${sdrName}, The Test Tribe
- Total length: 150–220 words
- Tone: confident, warm, not salesy
- Do NOT mention "intelligence" or "AI-generated"

Return ONLY a JSON object with exactly two keys: "subject" and "body". No explanation, no markdown fences.`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (message.content[0] as { text: string }).text.trim()

    let parsed: DraftEmailResponse
    try {
      const jsonStr = raw.startsWith('{') ? raw : raw.slice(raw.indexOf('{'))
      parsed = JSON.parse(jsonStr) as DraftEmailResponse
    } catch {
      const subjectMatch = raw.match(/"subject"\s*:\s*"([^"]+)"/)
      const bodyMatch    = raw.match(/"body"\s*:\s*"([\s\S]+?)"(?:\s*}|$)/)
      parsed = {
        subject: subjectMatch?.[1] ?? `Looking forward to our meeting — ${accountName}`,
        body:    bodyMatch?.[1]?.replace(/\\n/g, '\n') ?? raw,
      }
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[draft-email]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
