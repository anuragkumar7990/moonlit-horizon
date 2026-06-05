import { NextResponse } from 'next/server'
import { getContacts } from '@/lib/zoho'

export const revalidate = 60

export async function GET() {
  const contacts = await getContacts()
  return NextResponse.json(contacts)
}
