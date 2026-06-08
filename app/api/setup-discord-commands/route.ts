import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PASSWORD = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'
const DISCORD_API = 'https://discord.com/api/v10'

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (key !== PASSWORD) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const appId   = process.env.DISCORD_APP_ID
  const botToken = process.env.DISCORD_BOT_TOKEN
  if (!appId || !botToken) {
    return NextResponse.json({ error: 'DISCORD_APP_ID or DISCORD_BOT_TOKEN not set' }, { status: 500 })
  }

  const command = {
    name: 'touchpoint',
    description: 'Log a WhatsApp or In-person touchpoint for a contact',
    options: [
      {
        name: 'contact',
        description: 'Contact email address',
        type: 3, // STRING
        required: true,
      },
      {
        name: 'type',
        description: 'Touchpoint channel',
        type: 3, // STRING
        required: true,
        choices: [
          { name: 'WhatsApp', value: 'WhatsApp' },
          { name: 'In-person', value: 'In-person' },
        ],
      },
      {
        name: 'date',
        description: 'Date of touchpoint (YYYY-MM-DD, defaults to today)',
        type: 3, // STRING
        required: false,
      },
      {
        name: 'notes',
        description: 'Optional notes about the touchpoint',
        type: 3, // STRING
        required: false,
      },
    ],
  }

  const res = await fetch(`${DISCORD_API}/applications/${appId}/commands`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })

  const data = await res.json()
  return NextResponse.json({ ok: res.ok, status: res.status, command: data })
}
