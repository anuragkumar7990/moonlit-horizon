// Client-safe utilities — no server-only imports

export function lastContactRange(dateStr: string): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '—'
  const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const days = Math.floor((nowIST.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (days < 1)    return '< 1 day'
  if (days <= 3)   return '1–3 days'
  if (days <= 6)   return '4–6 days'
  if (days <= 13)  return '1 week+'
  if (days <= 20)  return '2–3 weeks'
  if (days <= 44)  return '1 month+'
  if (days <= 74)  return '2 months+'
  if (days <= 104) return '3 months+'
  return '3+ months'
}

export const RANGE_COLOR: Record<string, string> = {
  '< 1 day':    'text-green-400',
  '1–3 days':   'text-green-400',
  '4–6 days':   'text-mh-gold',
  '1 week+':    'text-mh-gold',
  '2–3 weeks':  'text-orange-400',
  '1 month+':   'text-orange-400',
  '2 months+':  'text-mh-vermillion',
  '3 months+':  'text-mh-vermillion',
  '3+ months':  'text-mh-vermillion',
  '—':          'text-mh-muted',
}
