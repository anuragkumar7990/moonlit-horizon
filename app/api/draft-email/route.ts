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
  meetingType?: string   // 'L1' | 'L2+'
  selectedIntelKeys: string[]  // which intel layers to include: 'cumulative' | 'email' | 'call' | 'circleback' | 'manual'
  additionalContext?: string
}

export interface DraftEmailResponse {
  subject: string
  body: string
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json() as DraftEmailRequest
    const { accountName, contactName, sdrName, meetingDate, meetingTime, meetingType, selectedIntelKeys, additionalContext } = payload

    if (!accountName || !contactName || !sdrName) {
      return NextResponse.json({ error: 'accountName, contactName and sdrName are required' }, { status: 400 })
    }

    // Pull Account Intelligence for this account
    const allIntel = await getAccountIntelligence()
    const intel = allIntel.find(i => i.account.toLowerCase() === accountName.toLowerCase())

    // Build the intel context string from selected layers
    const intelParts: string[] = []
    if (intel) {
      if (selectedIntelKeys.includes('cumulative') && intel.cumulativeSummary) {
        intelParts.push(`## Cumulative Account Summary\n${intel.cumulativeSummary}`)
      }
      if (selectedIntelKeys.includes('email') && intel.emailIntelligence) {
        intelParts.push(`## Email Thread Intelligence\n${intel.emailIntelligence}`)
      }
      if (selectedIntelKeys.includes('call') && intel.callIntelligence) {
        intelParts.push(`## Call Intelligence\n${intel.callIntelligence}`)
      }
      if (selectedIntelKeys.includes('circleback') && intel.circlebakIntelligence) {
        intelParts.push(`## Meeting Notes Intelligence\n${intel.circlebakIntelligence}`)
      }
      if (selectedIntelKeys.includes('manual') && intel.manualNotes) {
        intelParts.push(`## Manual Notes\n${intel.manualNotes}`)
      }
    }

    const intelContext = intelParts.length > 0
      ? intelParts.join('\n\n')
      : 'No prior intelligence available for this account.'

    const meetingDetails = [
      meetingType ? `Meeting type: ${meetingType === 'L1' ? 'L1 (Discovery Call)' : 'L2+ (Proposal / Deep-dive)'}` : '',
      meetingDate ? `Date: ${meetingDate}` : '',
      meetingTime ? `Time: ${meetingTime}` : '',
    ].filter(Boolean).join('\n')

    const prompt = `You are a business development representative at The Test Tribe, a corporate training company specialising in QA, AI/automation, and software testing upskilling.

You are writing a pre-meeting email to ${contactName} at ${accountName} before their upcoming training discussion with us.

## Meeting Details
${meetingDetails || 'Meeting details not specified.'}

## Prior Account Intelligence
${intelContext}
${additionalContext ? `\n## Additional Context\n${additionalContext}` : ''}

## Instructions
Write a warm, professional, concise pre-meeting email from ${sdrName} at The Test Tribe.

- Subject line should be specific and reference the company / meeting type
- Opening should greet ${contactName} by name and reference the upcoming meeting
- Middle section: weave in 2–3 relevant points from the intelligence above (pain points, prior conversations, interests) to show we've done our homework — but keep it natural, not like a data dump
- Close with a clear agenda confirmation or what we plan to cover
- Sign off warmly as ${sdrName}, The Test Tribe
- Total length: 150–220 words
- Tone: confident, warm, not salesy
- Do NOT mention the word "intelligence" or "AI-generated"

Return ONLY a JSON object with exactly two keys: "subject" and "body". No explanation, no markdown fences.`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (message.content[0] as { text: string }).text.trim()

    // Parse the JSON
    let parsed: DraftEmailResponse
    try {
      const jsonStr = raw.startsWith('{') ? raw : raw.slice(raw.indexOf('{'))
      parsed = JSON.parse(jsonStr) as DraftEmailResponse
    } catch {
      // Fallback: extract subject/body manually
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
