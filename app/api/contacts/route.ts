import { NextResponse } from 'next/server'
import { getContacts } from '@/lib/zoho'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const contacts = await getContacts()
    return NextResponse.json(contacts)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
