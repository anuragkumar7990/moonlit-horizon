import { NextRequest, NextResponse } from 'next/server'
import { createLeads, findLeadByEmail, addTagsToLead } from '@/lib/zoho'
import { appendProspectRows } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

// ── CSV parsing ──────────────────────────────────────────────────────────────

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
  // Rule 7: ignore empty-header columns
  const rawHeaders = parseCSVLine(lines[0]).map(h => h.trim())
  const headers = rawHeaders.map(h => h.toLowerCase())
  const validIndices = headers.map((h, i) => h ? i : -1).filter(i => i >= 0)

  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    validIndices.forEach(i => { row[headers[i]] = (values[i] ?? '').trim() })
    return row
  }).filter(row => Object.values(row).some(v => v))
}

// ── Column matching helpers ──────────────────────────────────────────────────

const normalise = (s: string) => s.replace(/[\s_\-]/g, '').toLowerCase()

function findKey(headers: string[], variants: string[]): string {
  for (const v of variants) {
    const match = headers.find(h => normalise(h) === normalise(v))
    if (match) return match
  }
  return ''
}

// Work email: any header containing both "work" and "email"
function findWorkEmailKey(headers: string[]): string {
  return headers.find(h => h.includes('work') && h.includes('email')) ?? ''
}

// ── Email logic ──────────────────────────────────────────────────────────────

const FREE_PROVIDERS = new Set([
  'gmail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.in', 'yahoo.co.uk',
  'hotmail.com', 'outlook.com', 'live.com', 'rediffmail.com', 'icloud.com',
  'protonmail.com', 'zohomail.in', 'ymail.com', 'mail.com',
])

function isFreeEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  return FREE_PROVIDERS.has(domain)
}

function selectEmail(workEmail: string, personalEmail: string): string {
  const work = workEmail.trim()
  const personal = personalEmail.trim()
  if (work && !isFreeEmail(work)) return work
  if (personal) return personal
  if (work) return work  // both free-provider: use work as fallback
  return ''
}

// ── Field cleaning ───────────────────────────────────────────────────────────

// Rule 3: treat placeholder values as empty
function clean(val: string): string {
  const t = val.trim()
  if (/^[.\-]+$/.test(t)) return ''
  if (/^(n\/a|na|none|null|undefined)$/i.test(t)) return ''
  return t
}

// Rule 4: normalise phone to a clean, consistent +91XXXXXXXXXX shape (TTT's prospects are
// India-based). Strips non-digits, then a leading 0 / country-code variant if present, and
// requires exactly 10 digits left. Anything that doesn't reduce to a valid 10-digit number is
// rejected (undefined) rather than kept in a mangled/partial form — the old logic just
// prepended "+" once past 10 digits with no validation, so a stray leading 0 (e.g.
// "09876543210") produced an invalid "+09876543210" that looked plausible but wasn't, and
// anything under 10 digits was kept as-is instead of being flagged as missing.
function normalisePhone(val: string): string | undefined {
  let digits = val.trim().replace(/\D/g, '')
  if (!digits) return undefined
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)   // leading 0
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)  // country code, no +
  if (digits.length === 13 && digits.startsWith('091')) digits = digits.slice(3) // leading 0 + country code
  if (digits.length !== 10) return undefined
  return `+91${digits}`
}

// Rule 5: validate city
function cleanCity(val: string): string | undefined {
  const t = clean(val)
  if (!t) return undefined
  if (/^\d+$/.test(t)) return undefined  // all digits
  return t
}

// ── Attendance → Lead Status (Rule 6) ────────────────────────────────────────

function attendanceToStatus(val: string): string {
  const t = val.trim().toLowerCase()
  const contacted = ['attended', 'yes', 'true', '1', 'going', 'checked in', 'checkedin', 'check-in', 'approved', 'attended webinar']
  if (contacted.includes(t)) return 'Contacted'
  return 'Not Contacted'
}

// ── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    const lvl1Source = (formData.get('lvl1Source') as string | null) ?? ''
    const lvl2Source = (formData.get('lvl2Source') as string | null) ?? ''

    const text = await file.text()
    const rows = parseCSV(text)
    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV is empty or has only a header row' }, { status: 400 })
    }

    const headers = Object.keys(rows[0])

    // Detect column keys
    const firstNameKey    = findKey(headers, ['firstname', 'first name', 'first_name'])
    const lastNameKey     = findKey(headers, ['lastname', 'last name', 'last_name'])
    const nameKey         = findKey(headers, ['name', 'fullname', 'full name', 'attendee', 'participant'])
    const companyKey      = findKey(headers, ['company', 'organization', 'organisation', 'account', 'companyname', 'company name', 'employer', 'org'])
    const personalEmailKey = findKey(headers, ['email', 'emailaddress', 'email address', 'e-mail', 'contactemail', 'contact email'])
    const workEmailKey    = findWorkEmailKey(headers)
    const phoneKey        = findKey(headers, ['phone_number', 'phone', 'mobile', 'mobile phone', 'mobilephone', 'phonenumber', 'phone number', 'contact number', 'contactphone', 'contact phone', 'cell', 'cell phone', 'telephone', 'work phone'])
    const designationKey  = findKey(headers, ['designation', 'title', 'role', 'jobtitle', 'job title', 'position', 'job role', 'seniority'])
    const priorityKey     = findKey(headers, ['priority'])
    const cityKey         = findKey(headers, ['city', 'location'])
    const attendanceKey   = findKey(headers, ['attendance', 'checkedin', 'checked in', 'check in', 'checkin', 'ticketstatus', 'ticket status', 'registrationstatus', 'registration status', 'going', 'status'])

    if (!personalEmailKey && !workEmailKey) {
      return NextResponse.json({
        error: 'Could not find an Email column. Expected a column named "Email", "Work Email", or similar.',
      }, { status: 400 })
    }

    // ── Within-file dedup tracking (Rule 9) ──────────────────────────────────
    const seenEmails = new Set<string>()
    const seenPhones = new Set<string>()
    const seenNames  = new Set<string>()

    type ParsedLead = {
      firstName: string; lastName: string; company: string; email: string
      phone?: string; designation?: string; city?: string; leadStatus?: string
      lvl1Source?: string; lvl2Source?: string; priority?: string
    }

    type RowResult = { row: number; status: 'created' | 'skipped' | 'updated' | 'error' | 'excluded'; id?: string; reason?: string }

    const leads: ParsedLead[] = []
    const preResults: RowResult[] = []

    rows.forEach((row, idx) => {
      const rowNum = idx + 1

      // Rule 1: skip excluded rows
      const priority = clean(priorityKey ? row[priorityKey] ?? '' : '')
      if (priority.toLowerCase() === 'skip') {
        preResults.push({ row: rowNum, status: 'excluded', reason: 'Priority = Skip' })
        return
      }

      // Email selection (Rule 2)
      const workEmail     = workEmailKey     ? clean(row[workEmailKey]     ?? '') : ''
      const personalEmail = personalEmailKey ? clean(row[personalEmailKey] ?? '') : ''
      const email = selectEmail(workEmail, personalEmail)
      if (!email) {
        preResults.push({ row: rowNum, status: 'error', reason: 'No valid email address found' })
        return
      }

      // Phone (Rule 4)
      const phone = normalisePhone(phoneKey ? row[phoneKey] ?? '' : '')

      // Name (Rules 3 + 8)
      let firstName = clean(firstNameKey ? row[firstNameKey] ?? '' : '')
      let lastName  = clean(lastNameKey  ? row[lastNameKey]  ?? '' : '')
      if (!firstName && !lastName && nameKey) {
        const parts = clean(row[nameKey] ?? '').split(/\s+/)
        firstName = parts[0] ?? ''
        lastName  = parts.slice(1).join(' ')
      }
      // If still no last name, promote first name to last name (Zoho requires Last_Name)
      if (!lastName && firstName) {
        lastName  = firstName
        firstName = ''
      }
      const company     = clean(companyKey     ? row[companyKey]     ?? '' : '')
      const designation = clean(designationKey ? row[designationKey] ?? '' : '') || undefined
      const city        = cleanCity(cityKey ? row[cityKey] ?? '' : '')
      const leadStatus  = attendanceKey ? attendanceToStatus(row[attendanceKey] ?? '') : 'Not Contacted'
      const priorityTag = /^p[123]$/i.test(priority) ? priority.toUpperCase() : undefined

      if (!lastName) {
        if (!company) {
          preResults.push({ row: rowNum, status: 'error', reason: 'No name or company to use as Last Name' })
          return
        }
        // fallback: use company as last name
      }

      // Rule 9: within-file dedup
      const emailKey2 = email.toLowerCase()
      const fullName  = `${firstName} ${lastName}`.trim().toLowerCase()

      if (seenEmails.has(emailKey2)) {
        preResults.push({ row: rowNum, status: 'skipped', reason: 'Duplicate email in this file' })
        return
      }
      if (phone && seenPhones.has(phone)) {
        preResults.push({ row: rowNum, status: 'skipped', reason: 'Duplicate phone number in this file' })
        return
      }
      if (fullName && seenNames.has(fullName)) {
        preResults.push({ row: rowNum, status: 'skipped', reason: 'Duplicate name in this file' })
        return
      }

      seenEmails.add(emailKey2)
      if (phone) seenPhones.add(phone)
      if (fullName) seenNames.add(fullName)

      leads.push({ firstName, lastName: lastName || company, company, email, phone, designation, city, leadStatus, lvl1Source: lvl1Source || undefined, lvl2Source: lvl2Source || undefined, priority: priorityTag })
      preResults.push({ row: rowNum, status: 'created' })  // placeholder — updated after Zoho call
    })

    // ── Send valid leads to Zoho ──────────────────────────────────────────────
    const pendingIndices = preResults
      .map((r, i) => (r.status === 'created' ? i : -1))
      .filter(i => i >= 0)

    if (pendingIndices.length > 0) {
      const { results: zohoResults } = await createLeads(leads)
      zohoResults.forEach((zr, idx) => {
        const preIdx = pendingIndices[idx]
        preResults[preIdx] = {
          row: preResults[preIdx].row,
          status: zr.status,
          id: zr.id,
          reason: zr.reason,
        }
      })
    }

    // For Zoho duplicates: tag with lvl2Source (and priority) instead of just skipping
    const tagsToAdd = [lvl2Source, ''].filter(Boolean) // will add priority below per-lead
    if (lvl2Source) {
      const zohoSkipped = preResults
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => r.status === 'skipped' && r.reason === 'Already exists in Zoho')
      await Promise.all(zohoSkipped.map(async ({ r, i }) => {
        const leadIdx = pendingIndices.indexOf(i)
        if (leadIdx < 0) return
        const lead = leads[leadIdx]
        const tags = [lvl2Source, lead.priority].filter((t): t is string => Boolean(t))
        const existingId = await findLeadByEmail(lead.email)
        if (existingId) {
          await addTagsToLead(existingId, tags)
          preResults[i] = { ...r, status: 'updated', reason: `Tagged: ${tags.join(', ')}` }
        }
      }))
    }
    void tagsToAdd

    const created  = preResults.filter(r => r.status === 'created').length
    const skipped  = preResults.filter(r => r.status === 'skipped').length
    const updated  = preResults.filter(r => r.status === 'updated').length
    const excluded = preResults.filter(r => r.status === 'excluded').length
    const errors   = preResults.filter(r => r.status === 'error').length

    // Write created + updated leads to Google Sheets (Prospects tab)
    const uploadDate = new Date().toISOString().slice(0, 10)
    const sheetRows = preResults
      .map((r, i) => {
        if (r.status !== 'created' && r.status !== 'updated') return null
        const leadIdx = pendingIndices.indexOf(i)
        if (leadIdx < 0) return null
        const l = leads[leadIdx]
        return {
          date: uploadDate,
          email: l.email,
          firstName: l.firstName,
          lastName: l.lastName,
          company: l.company,
          designation: l.designation,
          city: l.city,
          phone: l.phone,
          lvl1Source: l.lvl1Source,
          lvl2Source: l.lvl2Source,
          priority: l.priority,
          status: r.status as 'created' | 'updated',
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    await appendProspectRows(sheetRows).catch(err => console.error('[Sheets] appendProspectRows failed:', err))

    return NextResponse.json({
      ok: true,
      total: rows.length,
      created,
      skipped,
      updated,
      excluded,
      errors,
      results: preResults,
    })
  } catch (err) {
    console.error('[/api/upload-prospects]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
