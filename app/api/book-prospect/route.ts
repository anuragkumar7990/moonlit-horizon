import { NextRequest, NextResponse } from 'next/server'
import { getLeadById, findOrCreateAccount, convertLead, linkContactToAccount, getContactById } from '@/lib/zoho'
import { bookMeeting } from '@/lib/booking'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { leadId, meetingTime, meetingType } = await req.json() as {
      leadId: string
      meetingTime: string
      meetingType: 'L1' | 'L2+'
    }

    if (!leadId || !meetingTime) {
      return NextResponse.json({ error: 'leadId and meetingTime are required' }, { status: 400 })
    }

    const lead = await getLeadById(leadId)
    if (!lead) {
      return NextResponse.json({ error: `Lead ${leadId} not found` }, { status: 404 })
    }
    if (!lead.email) {
      return NextResponse.json({ error: `Lead ${lead.firstName} ${lead.lastName} has no email address` }, { status: 400 })
    }

    const companyName = lead.company || `${lead.firstName} ${lead.lastName}`.trim()

    // Find or create the Account
    const account = await findOrCreateAccount(companyName)

    // Convert Lead → Contact (pass email so ALREADY_CONVERTED case falls back to contact lookup)
    const converted = await convertLead(leadId, lead.email)
    if (!converted) {
      return NextResponse.json(
        { error: `Failed to convert Lead ${leadId} — check Zoho logs for details` },
        { status: 500 }
      )
    }

    // Link Contact to Account if Zoho didn't do it automatically
    if (!converted.accountId) {
      await linkContactToAccount(converted.contactId, account.id)
    }

    const accountId = converted.accountId || account.id
    const accountName = converted.accountName || account.accountName

    // Fetch fresh contact for email/phone
    const contact = await getContactById(converted.contactId)
    const contactEmail = contact?.email || lead.email
    const contactPhone = contact?.phone || ''
    const contactName = contact
      ? `${contact.firstName} ${contact.lastName}`.trim()
      : `${lead.firstName} ${lead.lastName}`.trim()

    const result = await bookMeeting({
      accountId,
      accountName,
      contactName,
      contactEmail,
      contactPhone,
      meetingTime,
      meetingType: meetingType ?? 'L1',
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[/api/book-prospect]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
