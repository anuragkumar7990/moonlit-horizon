import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAccountIntelligence, getContactIntelligence } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface InsightCategory {
  category: string
  points: string[]
}

export interface MeetingPrepResponse {
  insights: InsightCategory[]
  accountFound: boolean
  contactFound: boolean
}

export async function POST(req: NextRequest) {
  try {
    const { accountName, contactName, additionalContext } = await req.json() as {
      accountName: string
      contactName: string
      additionalContext?: string
    }

    if (!accountName || !contactName) {
      return NextResponse.json({ error: 'accountName and contactName are required' }, { status: 400 })
    }

    const [allAccountIntel, allContactIntel] = await Promise.all([
      getAccountIntelligence(),
      getContactIntelligence(),
    ])

    const accountIntel = allAccountIntel.find(
      i => i.account.toLowerCase() === accountName.toLowerCase()
    )
    const contactIntel = allContactIntel.find(
      c => c.name.toLowerCase() === contactName.toLowerCase() ||
           c.email.toLowerCase() === contactName.toLowerCase()
    )

    const contextParts: string[] = []

    if (accountIntel?.cumulativeSummary) {
      contextParts.push(`## Cumulative Account Summary\n${accountIntel.cumulativeSummary}`)
    }
    if (accountIntel?.callIntelligence) {
      contextParts.push(`## Call Intelligence\n${accountIntel.callIntelligence}`)
    }
    if (accountIntel?.emailIntelligence) {
      contextParts.push(`## Email Intelligence\n${accountIntel.emailIntelligence}`)
    }
    if (accountIntel?.circlebakIntelligence) {
      contextParts.push(`## Meeting / Circleback Notes\n${accountIntel.circlebakIntelligence}`)
    }
    if (accountIntel?.manualNotes) {
      contextParts.push(`## Manual Notes\n${accountIntel.manualNotes}`)
    }
    if (contactIntel) {
      const lines = [
        `Name: ${contactIntel.name}`,
        contactIntel.title   ? `Title: ${contactIntel.title}` : '',
        contactIntel.company ? `Company: ${contactIntel.company}` : '',
        contactIntel.zohoStage ? `CRM Stage: ${contactIntel.zohoStage}` : '',
        `Total Calls: ${contactIntel.totalCalls} (${contactIntel.connectedCalls} connected)`,
        contactIntel.lastCallDate    ? `Last Call: ${contactIntel.lastCallDate}` : '',
        contactIntel.lastCallOutcome ? `Last Outcome: ${contactIntel.lastCallOutcome}` : '',
      ].filter(Boolean)
      contextParts.push(`## Contact Profile\n${lines.join('\n')}`)
    }
    if (additionalContext) {
      contextParts.push(`## Additional Context\n${additionalContext}`)
    }

    if (contextParts.length === 0) {
      return NextResponse.json({
        insights: [],
        accountFound: !!accountIntel,
        contactFound: !!contactIntel,
      })
    }

    const prompt = `You are a sales intelligence analyst helping a B2B training company prepare for a meeting.

Account: ${accountName}
Contact: ${contactName}

Available intelligence:
${contextParts.join('\n\n')}

Extract concise, actionable meeting-preparation insights. Return ONLY this JSON structure — no markdown fences, no explanation:

{
  "insights": [
    { "category": "Background", "points": ["..."] },
    { "category": "Engagement History", "points": ["..."] },
    { "category": "Pain Points", "points": ["..."] },
    { "category": "Opportunities", "points": ["..."] },
    { "category": "Talking Points", "points": ["..."] },
    { "category": "Potential Objections", "points": ["..."] }
  ]
}

Rules:
- Only include a category if you have actual intelligence to support it
- Max 4 bullet points per category
- Each point max 18 words, specific and actionable
- Omit empty categories entirely`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (message.content[0] as { text: string }).text.trim()
    const start = raw.indexOf('{')
    const end   = raw.lastIndexOf('}')
    const jsonStr = start !== -1 && end !== -1 ? raw.slice(start, end + 1) : raw
    const parsed = JSON.parse(jsonStr) as { insights: InsightCategory[] }

    return NextResponse.json({
      insights: parsed.insights ?? [],
      accountFound: !!accountIntel,
      contactFound: !!contactIntel,
    } satisfies MeetingPrepResponse)
  } catch (err) {
    console.error('[meeting-prep]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
