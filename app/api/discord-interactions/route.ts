import { NextRequest, NextResponse } from 'next/server'
import nacl from 'tweetnacl'
import { appendManualTouchpoint } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY ?? ''

// Discord interaction types
const PING = 1
const APPLICATION_COMMAND = 2

// Discord response types
const PONG = 1
const CHANNEL_MESSAGE_WITH_SOURCE = 4

function hexToUint8(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

export async function POST(req: NextRequest) {
  if (!PUBLIC_KEY) {
    return NextResponse.json({ error: 'DISCORD_PUBLIC_KEY not configured' }, { status: 500 })
  }

  const signature = req.headers.get('x-signature-ed25519') ?? ''
  const timestamp  = req.headers.get('x-signature-timestamp') ?? ''
  const rawBody    = await req.text()

  const isValid = nacl.sign.detached.verify(
    Buffer.from(timestamp + rawBody),
    hexToUint8(signature),
    hexToUint8(PUBLIC_KEY)
  )

  if (!isValid) {
    return new NextResponse('Invalid request signature', { status: 401 })
  }

  const body = JSON.parse(rawBody) as {
    type: number
    data?: {
      name: string
      options?: { name: string; value: string }[]
    }
  }

  // Respond to Discord's PING verification
  if (body.type === PING) {
    return NextResponse.json({ type: PONG })
  }

  if (body.type === APPLICATION_COMMAND && body.data?.name === 'touchpoint') {
    const options = body.data.options ?? []
    const get = (name: string) => options.find(o => o.name === name)?.value ?? ''

    const contact  = get('contact')
    const type     = get('type') as 'WhatsApp' | 'In-person'
    const notes    = get('notes')
    const now      = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    const date     = get('date') || now.toISOString().slice(0, 10)

    // contact field is the email (as documented in the slash command)
    await appendManualTouchpoint(contact, date, type, notes, 'Discord').catch(() => {})

    const content = `Touchpoint logged\n**Contact:** ${contact}\n**Type:** ${type}\n**Date:** ${date}${notes ? `\n**Notes:** ${notes}` : ''}`

    return NextResponse.json({
      type: CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content },
    })
  }

  return NextResponse.json({ type: CHANNEL_MESSAGE_WITH_SOURCE, data: { content: 'Unknown command' } })
}
