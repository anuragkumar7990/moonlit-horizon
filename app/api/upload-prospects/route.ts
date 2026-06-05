import { NextRequest, NextResponse } from 'next/server'
import { createLeads } from '@/lib/zoho'

export const dynamic = 'force-dynamic'

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else { inQuotes = !inQuotes }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase())
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim() })
    return row
  }).filter(row => Object.values(row).some(v => v))
}

function findKey(headers: string[], variants: string[]): string {
  const normalise = (s: string) => s.replace(/[\s_\-]/g, '').toLowerCase()
  for (const v of variants) {
    const match = headers.find(h => normalise(h) === normalise(v))
    if (match) return match
  }
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const text = await file.text()
    const rows = parseCSV(text)
    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV is empty or has only a header row' }, { status: 400 })
    }

    const headers = Object.keys(rows[0])
    const firstNameKey = findKey(headers, ['firstname', 'first name', 'first_name'])
    const lastNameKey  = findKey(headers, ['lastname', 'last name', 'last_name'])
    const nameKey      = findKey(headers, ['name', 'fullname', 'full name'])
    const companyKey   = findKey(headers, ['company', 'organization', 'organisation', 'account', 'companyname', 'company name'])
    const emailKey     = findKey(headers, ['email', 'emailaddress', 'email address', 'e-mail'])
    const phoneKey     = findKey(headers, ['phone', 'mobile', 'phonenumber', 'phone number', 'contact number'])
    const designationKey = findKey(headers, ['designation', 'title', 'role', 'jobtitle', 'job title', 'position'])

    if (!emailKey) {
      return NextResponse.json({
        error: 'Could not find an Email column. Expected a column named "Email", "Email Address", or "E-mail".',
      }, { status: 400 })
    }

    const leads = rows.map(row => {
      let firstName = firstNameKey ? row[firstNameKey] ?? '' : ''
      let lastName  = lastNameKey  ? row[lastNameKey]  ?? '' : ''
      if (!firstName && !lastName && nameKey) {
        const parts = (row[nameKey] ?? '').trim().split(/\s+/)
        firstName = parts[0] ?? ''
        lastName  = parts.slice(1).join(' ')
      }
      return {
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        company:   companyKey   ? (row[companyKey]   ?? '').trim() : '',
        email:     (row[emailKey] ?? '').trim(),
        phone:     phoneKey       ? (row[phoneKey]       ?? '').trim() || undefined : undefined,
        designation: designationKey ? (row[designationKey] ?? '').trim() || undefined : undefined,
      }
    }).filter(l => l.email)

    if (leads.length === 0) {
      return NextResponse.json({
        error: 'No rows with email addresses found. Make sure the CSV has a non-empty Email column.',
      }, { status: 400 })
    }

    const { results } = await createLeads(leads)
    const created = results.filter(r => r.status === 'created').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const errors  = results.filter(r => r.status === 'error').length

    return NextResponse.json({ ok: true, total: leads.length, created, skipped, errors, results })
  } catch (err) {
    console.error('[/api/upload-prospects]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
