// Shared company-name resolution primitives for the Zoho Calls/Meetings pipeline.
// Single source of truth so the webhook path (app/api/webhook/zoho-call),
// the call processor (zoho-call-processor.ts), and the dashboard call-stats
// reads (zoho.ts) can't drift on what counts as a junk result, a junk account,
// a free email domain, or how a company name gets cased.

export const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'yahoo.in', 'yahoo.co.in',
  'hotmail.com', 'hotmail.co.in', 'outlook.com', 'live.com',
  'rediffmail.com', 'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me', 'aol.com', 'ymail.com',
])

export const JUNK_ACCOUNT_NAMES = new Set([
  'discord bot', 'test1', 'test', 'test call', 'test account',
  'the test tribe', 'thetesttribe',
  // Generic/bad inferences that are never real accounts
  'india', '123', 'mt',
])

// Call results set automatically by Zoho AI / telephony — not real SDR dials
export const JUNK_CALL_RESULTS = new Set([
  'ai processed',
  'ai processed via cloud folder',
  'ai call processed',
  'processed',
])

export function toTitleCase(str: string): string {
  if (!str) return str
  // Preserve all-caps tokens (abbreviations like LTM, KPMG, ABB)
  return str.replace(/\w+/g, w => w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

export function inferCompanyFromDomain(email: string): string {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain || FREE_EMAIL_DOMAINS.has(domain)) return ''
  const label = domain.split('.')[0]
  if (!label) return ''
  return label.length <= 4 ? label.toUpperCase() : label.charAt(0).toUpperCase() + label.slice(1)
}

export function isJunkAccountName(name: string): boolean {
  return JUNK_ACCOUNT_NAMES.has(name.toLowerCase().trim())
}

export function isJunkCallResult(result: string): boolean {
  return JUNK_CALL_RESULTS.has(result.toLowerCase().trim())
}

export function untaggedCompanyName(id: string): string {
  return `Untagged Company #${id.slice(-6).toUpperCase()}`
}

// Last-resort resolution when no company name could be found via Lead/Contact/Prospects
// data: a domain-inferred name (already correctly cased by inferCompanyFromDomain) if
// available, else a deterministic "Untagged Company #<hash>" placeholder.
export function resolveFallbackAccountName(email: string | undefined, idForUntagged: string): string {
  if (email) {
    const inferred = inferCompanyFromDomain(email)
    if (inferred) return inferred
  }
  return untaggedCompanyName(idForUntagged)
}
