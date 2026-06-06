require('dotenv').config()
const { Client, GatewayIntentBits, InteractionType } = require('discord.js')
const cron = require('node-cron')

const VERCEL_URL = process.env.VERCEL_URL || 'https://moonlit-horizon.vercel.app'
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'thetesttribe'
const BASIC_AUTH = 'Basic ' + Buffer.from(':' + DASHBOARD_PASSWORD).toString('base64')

async function vercelGet(path) {
  const res = await fetch(`${VERCEL_URL}${path}`, {
    headers: { Authorization: BASIC_AUTH },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Vercel ${path} → ${res.status}`)
  return res.json()
}

async function vercelPost(path, body) {
  const res = await fetch(`${VERCEL_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: BASIC_AUTH },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Vercel POST ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

// Parse "YYYY-MM-DD HH:MM" as IST
function parseIST(str) {
  const clean = str.trim()
  const normalised = clean.replace('T', ' ')
  const m = normalised.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/)
  if (!m) return null
  return `${m[1]}T${m[2]}:00+05:30`
}

// Outcome label for display
const OUTCOME_LABELS = {
  'meeting booked':   '✅ Meeting Booked',
  'connected':        '✅ Connected — Interested',
  'not interested':   '✅ Connected — Not Interested',
  'callback later':   '✅ Connected — Callback Later',
  'send more info':   '✅ Connected — Send More Info',
  'no answer':        '📵 No Answer',
  'voicemail':        '📵 Voicemail',
  'busy':             '📵 Busy',
  'wrong number':     '📵 Wrong Number',
}

// Cache for autocomplete data — refreshed every 5 minutes
const cache = { accounts: [], contacts: [], leads: [], p0Tasks: [], lastFetch: 0 }

async function refreshCache() {
  try {
    const [accounts, contacts, leads, p0Open] = await Promise.all([
      vercelGet('/api/accounts'),
      vercelGet('/api/contacts'),
      vercelGet('/api/leads'),
      vercelGet('/api/p0-tasks/open'),
    ])
    cache.accounts = accounts
    cache.contacts = contacts
    cache.leads = leads
    cache.p0Tasks = p0Open.tasks ?? []
    cache.lastFetch = Date.now()
    console.log(`Cache refreshed — ${accounts.length} accounts, ${contacts.length} contacts, ${leads.length} leads, ${cache.p0Tasks.length} open P0 tasks`)
  } catch (err) {
    console.error('Cache refresh failed:', err)
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

// ── Stats digest formatter ───────────────────────────────────────
function fmtStat(achieved, target) {
  if (target == null) return `**${achieved}**`
  return `**${achieved}** / ${target}`
}

function fmtAmount(n) {
  if (!n) return '₹0'
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  return `₹${n.toLocaleString('en-IN')}`
}

function buildDigestMessage(data) {
  const { tanishq, meetingsData, todayMeetings, leads, funnel } = data

  const d   = tanishq.daily
  const w   = tanishq.weekly
  const mw  = meetingsData.weekly
  const mwt = meetingsData.targets.weekly

  // Date header in IST
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

  // Connection rate today
  const connRate = d.dialled.achieved > 0
    ? ` (${Math.round((d.connected.achieved / d.dialled.achieved) * 100)}%)`
    : ''

  const lines = [
    `📊 **Daily Stats — ${dateStr}**`,
    '',
    `**📞 Calls Today**`,
    `Dialled: ${fmtStat(d.dialled.achieved, d.dialled.target)} · Connected: ${fmtStat(d.connected.achieved, d.connected.target)}${connRate} · Booked: ${fmtStat(d.meetingsBooked.achieved, d.meetingsBooked.target)}`,
    '',
    `**📅 This Week**`,
    `Calls: **${w.dialled.achieved}** dialled / ${w.dialled.target ?? '—'} · **${w.connected.achieved}** connected / ${w.connected.target ?? '—'}`,
    `Meetings: **${mw.l1Booked}** L1 booked / ${mwt.l1Booked ?? '—'} · **${mw.l1Conducted}** L1 conducted / ${mwt.l1Conducted ?? '—'} · **${mw.l2Conducted}** L2`,
  ]

  if (todayMeetings > 0) {
    lines.push(`📆 **Meetings today:** ${todayMeetings}`)
  }

  lines.push(
    '',
    `**🔥 Pipeline**`,
    `🔴 Hot: **${leads.hot}** · 🟡 Warm: **${leads.warm}** · 🔵 Cold: **${leads.cold}** · Total: **${leads.total}**`,
  )

  if (funnel.stages.length > 0) {
    const stageStr = funnel.stages
      .map(s => `${s.stage.replace('Discovery Call', 'DC')}: **${s.count}**`)
      .join(' · ')
    lines.push('', `**🔄 Funnel**`, stageStr)
  }

  if (funnel.won.count > 0 || funnel.lost.count > 0) {
    lines.push(`✅ Won: **${funnel.won.count}** (${fmtAmount(funnel.won.amount)}) · ❌ Lost: **${funnel.lost.count}**`)
  }

  return lines.join('\n')
}

// ── P0 Task Generator formatter ──────────────────────────────────

const STAGE_GROUP = {
  'negotiation':               'followup',
  'payment pending':           'followup',
  'discovery call conducted':  'l2-meeting',
  'outline meeting conducted': 'proposal',
}

function fmtClosingDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yy = String(d.getFullYear()).slice(2)
    return `${dd}/${mm}/${yy}`
  } catch { return '' }
}

function dealLine(n, t) {
  const contact = t.contactName || '—'
  const account = t.accountName || '—'
  const topic   = t.dealName    || account
  const date    = fmtClosingDate(t.closingDate)
  return `${n}. ${contact}, ${account} _(${t.stage})_ — ${topic}${date ? ' · ' + date : ''}`
}

function buildP0Message(data) {
  const { tasks } = data

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

  if (!tasks || tasks.length === 0) {
    return `✅ **P0 Tasks — ${dateStr}**\n\nNo P0 tasks today. Clean slate!`
  }

  const stale    = tasks.filter(t => t.category === 'stale-deal')
  const callback = tasks.filter(t => t.category === 'overdue-callback')
  const noNotes  = tasks.filter(t => t.category === 'no-notes')
  const overdue  = tasks.filter(t => t.category === 'overdue-closing')
  const others   = tasks.filter(t => t.category === 'other')

  const followup  = stale.filter(t => STAGE_GROUP[(t.stage || '').toLowerCase()] === 'followup')
  const l2meeting = stale.filter(t => STAGE_GROUP[(t.stage || '').toLowerCase()] === 'l2-meeting')
  const proposal  = stale.filter(t => STAGE_GROUP[(t.stage || '').toLowerCase()] === 'proposal')

  const lines = [`⚠️ **P0 Tasks — ${dateStr}** (${tasks.length} item${tasks.length !== 1 ? 's' : ''})`]

  if (followup.length > 0) {
    lines.push('', `**📞 Follow-up calls to be made (${followup.length}) — Tanishq**`)
    followup.forEach((t, i) => lines.push(dealLine(i + 1, t)))
  }

  if (l2meeting.length > 0) {
    lines.push('', `**📋 Outline meetings to book (${l2meeting.length}) — Anurag**`)
    l2meeting.forEach((t, i) => lines.push(dealLine(i + 1, t)))
  }

  if (proposal.length > 0) {
    lines.push('', `**📄 Proposals to be sent (${proposal.length}) — Anurag**`)
    proposal.forEach((t, i) => lines.push(dealLine(i + 1, t)))
  }

  if (callback.length > 0) {
    lines.push('', `**🔁 Overdue callbacks (${callback.length}) — Tanishq**`)
    callback.forEach((t, i) => lines.push(`${i + 1}. ${t.task.replace('Overdue callback: ', '')} — _${t.detail}_`))
  }

  if (noNotes.length > 0) {
    lines.push('', `**📝 Meeting notes pending (${noNotes.length}) — Tanishq**`)
    noNotes.forEach((t, i) => lines.push(`${i + 1}. ${t.task.replace('Add follow-up notes for ', '')} — _${t.detail}_`))
  }

  if (overdue.length > 0) {
    lines.push('', `**📅 Overdue closing dates (${overdue.length}) — Anurag**`)
    overdue.forEach((t, i) => lines.push(`${i + 1}. ${t.task.replace('Closing date overdue: ', '')} — _${t.detail}_`))
  }

  if (others.length > 0) {
    lines.push('', `**🗂️ Others (${others.length}) — Anurag**`)
    others.forEach((t, i) => lines.push(`${i + 1}. ${t.task}${t.detail ? ' — _' + t.detail + '_' : ''}`))
  }

  return lines.join('\n')
}

function buildSummaryMessage(tasks) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

  if (!tasks || tasks.length === 0) {
    return `✅ **P0 Summary — ${dateStr}**\n\nNo open P0 tasks. Clean slate!`
  }

  const followup  = tasks.filter(t => /^(Follow up on deal|Chase payment):/i.test(t.task))
  const l2meeting = tasks.filter(t => /^Book L2 meeting:/i.test(t.task))
  const proposal  = tasks.filter(t => /^Send proposal:/i.test(t.task))
  const callback  = tasks.filter(t => /^Overdue callback:/i.test(t.task))
  const noNotes   = tasks.filter(t => /^Add follow-up notes/i.test(t.task))
  const overdue   = tasks.filter(t => /^Closing date overdue:/i.test(t.task))
  const flagged   = new Set([...followup, ...l2meeting, ...proposal, ...callback, ...noNotes, ...overdue])
  const others    = tasks.filter(t => !flagged.has(t))

  const accountFrom = t => t.task.replace(/^[^:]+:\s*/, '')

  const lines = [`📋 **P0 Summary — ${dateStr}** (${tasks.length} open)`]

  if (followup.length > 0) {
    lines.push('', `**📞 Follow-up calls (${followup.length}) — Tanishq**`)
    followup.forEach((t, i) => lines.push(`${i + 1}. ${accountFrom(t)}`))
  }
  if (l2meeting.length > 0) {
    lines.push('', `**📋 Outline meetings to book (${l2meeting.length}) — Anurag**`)
    l2meeting.forEach((t, i) => lines.push(`${i + 1}. ${accountFrom(t)}`))
  }
  if (proposal.length > 0) {
    lines.push('', `**📄 Proposals to be sent (${proposal.length}) — Anurag**`)
    proposal.forEach((t, i) => lines.push(`${i + 1}. ${accountFrom(t)}`))
  }
  if (others.length > 0) {
    lines.push('', `**🗂️ Others (${others.length})**`)
    others.forEach((t, i) => lines.push(`${i + 1}. ${t.task}`))
  }
  if (callback.length > 0) {
    lines.push('', `**🔁 Overdue callbacks (${callback.length}) — Tanishq**`)
    callback.forEach((t, i) => lines.push(`${i + 1}. ${t.task.replace('Overdue callback: ', '')}`))
  }
  if (noNotes.length > 0) {
    lines.push('', `**📝 Meeting notes pending (${noNotes.length}) — Tanishq**`)
    noNotes.forEach((t, i) => lines.push(`${i + 1}. ${t.task.replace('Add follow-up notes for ', '')}`))
  }
  if (overdue.length > 0) {
    lines.push('', `**📅 Overdue closing dates (${overdue.length}) — Anurag**`)
    overdue.forEach((t, i) => lines.push(`${i + 1}. ${t.task.replace('Closing date overdue: ', '')}`))
  }

  return lines.join('\n')
}

function splitIntoChunks(text, limit = 1900) {
  const lines = text.split('\n')
  const chunks = []
  let current = ''
  for (const line of lines) {
    const candidate = current ? current + '\n' + line : line
    if (candidate.length > limit) {
      if (current) chunks.push(current)
      current = line
    } else {
      current = candidate
    }
  }
  if (current) chunks.push(current)
  return chunks
}

async function postP0Tasks() {
  try {
    const data = await vercelGet('/api/p0-tasks')
    const message = buildP0Message(data)
    const channel = client.channels.cache.find(c => c.name === 'p0-tasks')
    if (!channel) {
      console.error('[p0] #p0-tasks channel not found')
      return
    }
    const chunks = splitIntoChunks(message)
    for (const chunk of chunks) await channel.send(chunk)
    console.log(`[p0] Posted ${data.newCount} P0 tasks to #p0-tasks (${chunks.length} message${chunks.length > 1 ? 's' : ''})`)
  } catch (err) {
    console.error('[p0] Failed to post P0 tasks:', err.message)
  }
}

async function postDailyDigest() {
  try {
    const data = await vercelGet('/api/stats-digest')
    const message = buildDigestMessage(data)
    const statsChannel = client.channels.cache.find(c => c.name === 'stats')
    if (!statsChannel) {
      console.error('[digest] #stats channel not found')
      return
    }
    await statsChannel.send(message)
    console.log('[digest] Daily stats posted to #stats')
  } catch (err) {
    console.error('[digest] Failed to post daily stats:', err.message)
  }
}

async function updatePinnedTargets() {
  const channel = client.channels.cache.find(c => c.name === 'targets')
  if (!channel) return

  const data = await vercelGet('/api/targets')
  const now = new Date()
  const monthLabel = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'long', year: 'numeric' })

  const fmtTarget = (metric) => {
    const t = data.targets.find(t => t.metric === metric)
    return t?.target ? `**${t.target}**` : '—'
  }

  const lines = [
    `📊 **Monthly Targets — ${monthLabel}**`,
    '',
    'Use `/mh targets set` to update any metric.',
    '',
    '**📞 Calling**',
    `• Calls Dialled: ${fmtTarget('Calls Dialled')}`,
    `• Calls Connected: ${fmtTarget('Calls Connected')}`,
    `• Meetings Booked: ${fmtTarget('Meetings Booked')}`,
    '',
    '**📅 Meetings**',
    `• L1 Meetings Conducted: ${fmtTarget('L1 Meetings Conducted')}`,
    `• L2 Meetings Conducted: ${fmtTarget('L2 Meetings Conducted')}`,
    '',
    '_This message is pinned for the month._',
  ]
  const newContent = lines.join('\n')

  // Find existing pinned bot message and edit it, or post a new one and pin it
  const pinned = await channel.messages.fetchPinned()
  const existing = pinned.find(m => m.author.id === client.user.id)
  if (existing) {
    await existing.edit(newContent)
  } else {
    const msg = await channel.send(newContent)
    await msg.pin()
  }
}

async function postTargetsRequest() {
  try {
    const channel = client.channels.cache.find(c => c.name === 'targets')
    if (!channel) {
      console.error('[targets] #targets channel not found')
      return
    }

    // Unpin previous bot messages in #targets
    try {
      const pinned = await channel.messages.fetchPinned()
      for (const [, m] of pinned) {
        if (m.author.id === client.user.id) await m.unpin()
      }
    } catch { /* non-fatal */ }

    const data = await vercelGet('/api/targets').catch(() => ({ targets: [] }))
    const now = new Date()
    const monthLabel = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'long', year: 'numeric' })

    const fmtTarget = (metric) => {
      const t = data.targets.find(t => t.metric === metric)
      return t?.target ? `**${t.target}**` : '—'
    }

    const lines = [
      `📊 **Monthly Targets — ${monthLabel}**`,
      '',
      'Please set your targets using `/mh targets set`',
      '',
      '**📞 Calling**',
      `• Calls Dialled: ${fmtTarget('Calls Dialled')}`,
      `• Calls Connected: ${fmtTarget('Calls Connected')}`,
      `• Meetings Booked: ${fmtTarget('Meetings Booked')}`,
      '',
      '**📅 Meetings**',
      `• L1 Meetings Conducted: ${fmtTarget('L1 Meetings Conducted')}`,
      `• L2 Meetings Conducted: ${fmtTarget('L2 Meetings Conducted')}`,
      '',
      '_This message will be pinned for the month._',
    ]

    const msg = await channel.send(lines.join('\n'))
    await msg.pin()
    console.log('[targets] Monthly targets request posted and pinned to #targets')
  } catch (err) {
    console.error('[targets] Failed to post targets request:', err.message)
  }
}

async function postEndOfMonthReview() {
  try {
    const statsChannel = client.channels.cache.find(c => c.name === 'stats')
    if (!statsChannel) {
      console.error('[targets] #stats channel not found for end-of-month review')
      return
    }

    const data = await vercelGet('/api/targets')
    const now = new Date()
    const monthLabel = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'long', year: 'numeric' })

    const bar = (actual, target) => {
      if (!target) return `**${actual}** _(no target set)_`
      const pct = Math.round((actual / target) * 100)
      const emoji = pct >= 100 ? '🟢' : pct >= 70 ? '🟡' : '🔴'
      return `**${actual}** / ${target} ${emoji} ${pct}%`
    }

    const lines = [`📊 **End-of-Month Review — ${monthLabel}**`, '']
    for (const t of data.targets) {
      lines.push(`• **${t.metric}:** ${bar(t.actual, t.target)}`)
    }
    lines.push('', "_Next month's targets will be posted in #targets shortly._")

    const chunks = splitIntoChunks(lines.join('\n'))
    for (const chunk of chunks) await statsChannel.send(chunk)
    console.log('[targets] End-of-month review posted to #stats')
  } catch (err) {
    console.error('[targets] Failed to post end-of-month review:', err.message)
  }
}

// Circleback sync is webhook-driven — no polling needed.
// Meetings are marked Conducted automatically when Circleback fires to /api/circleback-sync.

async function runTop250Reranker() {
  try {
    const statsChannel = client.channels.cache.find(c => c.name === 'stats')
    const data = await vercelPost('/api/top-250', {})
    const lines = [
      `🎯 **Top-250 Weekly Re-rank Complete**`,
      `**Total uncalled prospects:** ${data.totalProspects}`,
      `**Tagged this run:** ${data.tagged} new · ${data.untagged} removed`,
      `_Tanishq's call list for the week is ready._`,
    ]
    if (statsChannel) await statsChannel.send(lines.join('\n'))
    console.log(`[top250] Re-rank done — ${data.tagged} tagged, ${data.untagged} removed`)
  } catch (err) {
    console.error('[top250] Re-rank failed:', err.message)
  }
}

async function postWeeklySummary() {
  try {
    const data = await vercelPost('/api/weekly-summary', {})
    const statsChannel = client.channels.cache.find(c => c.name === 'stats')
    if (!statsChannel) {
      console.error('[weekly] #stats channel not found')
      return
    }
    const lines = [
      `📊 **Weekly Summary — ${data.weekOf}**`,
      '',
      data.summary,
      '',
      `_Calls: ${data.stats.dialled} dialled · ${data.stats.connected} connected · ${data.stats.connectRate}% rate_`,
      `_Meetings: ${data.stats.l1Conducted} L1 · ${data.stats.l2Conducted} L2 conducted_`,
      `_Pipeline: ${data.stats.hotDeals} hot · ${data.stats.warmDeals} warm_`,
    ]
    const chunks = splitIntoChunks(lines.join('\n'))
    for (const chunk of chunks) await statsChannel.send(chunk)
    console.log('[weekly] Weekly summary posted to #stats')
  } catch (err) {
    console.error('[weekly] Failed to post weekly summary:', err.message)
  }
}

// ── Briefing formatter ───────────────────────────────────────────

function fmtMeetingTime(isoStr) {
  try {
    const d = new Date(isoStr)
    return d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true })
  } catch { return isoStr }
}

function buildBriefingMessage(data) {
  const { todayMeetings, callsToday, hotDeals, openTasks, leads } = data
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

  const lines = [`🌅 **Morning Briefing — ${dateStr}**`]

  // Calls today
  const ct = callsToday
  const dialledStr   = ct.targets.dialled   != null ? `${ct.dialled} / ${ct.targets.dialled}`   : `${ct.dialled}`
  const connStr      = ct.targets.connected  != null ? `${ct.connected} / ${ct.targets.connected}` : `${ct.connected}`
  const bookedStr    = ct.targets.booked     != null ? `${ct.booked} / ${ct.targets.booked}`     : `${ct.booked}`
  lines.push('', `**📞 Calls Today**`, `Dialled: **${dialledStr}** · Connected: **${connStr}** · Booked: **${bookedStr}**`)

  // Today's meetings
  if (todayMeetings.length === 0) {
    lines.push('', `**📅 Meetings Today**`, `_No meetings scheduled_`)
  } else {
    lines.push('', `**📅 Meetings Today (${todayMeetings.length})**`)
    todayMeetings.forEach(m => {
      const contact = m.contactName ? ` — ${m.contactName}` : ''
      lines.push(`• **${m.accountName}**${contact} @ ${fmtMeetingTime(m.meetingTime)} _(${m.meetingType})_`)
    })
  }

  // Open P0 tasks
  const p0Tasks = openTasks.filter(t => t.type === 'P0')
  if (p0Tasks.length === 0) {
    lines.push('', `**⚠️ P0 Tasks**`, `_No open P0 tasks_`)
  } else {
    lines.push('', `**⚠️ P0 Tasks (${p0Tasks.length})**`)
    p0Tasks.slice(0, 8).forEach(t => {
      const assignee = t.assignedTo ? ` — ${t.assignedTo}` : ''
      lines.push(`• ${t.task}${assignee}`)
    })
    if (p0Tasks.length > 8) lines.push(`_...and ${p0Tasks.length - 8} more — see #p0-tasks_`)
  }

  // Hot pipeline
  if (hotDeals.length > 0) {
    lines.push('', `**🔥 Hot Pipeline (${hotDeals.length} deals)**`)
    hotDeals.slice(0, 6).forEach(d => {
      const name = d.accountName || d.dealName || '—'
      const amt = d.amount >= 100000 ? `₹${(d.amount / 100000).toFixed(1)}L` : d.amount > 0 ? `₹${d.amount.toLocaleString('en-IN')}` : ''
      const amtStr = amt ? ` · ${amt}` : ''
      lines.push(`• **${name}** — ${d.stage}${amtStr}`)
    })
  }

  // Lead overview
  lines.push('', `🔴 Hot: **${leads.hot}** · 🟡 Warm: **${leads.warm}** · 🔵 Cold: **${leads.cold}** · Total: **${leads.total}**`)

  return lines.join('\n')
}

client.on('clientReady', () => {
  console.log(`✅ Logged in as ${client.user.tag}`)
  refreshCache()
  setInterval(refreshCache, 5 * 60 * 1000)

  // P0 task generator at 8:30am IST = 3:00am UTC
  cron.schedule('0 3 * * *', () => {
    console.log('[cron] Firing P0 task generator...')
    postP0Tasks()
  }, { timezone: 'UTC' })

  // Daily digest at 9:00am IST = 3:30am UTC
  cron.schedule('30 3 * * *', () => {
    console.log('[cron] Firing daily digest...')
    postDailyDigest()
  }, { timezone: 'UTC' })

  // Weekly summary at 9:00am IST on Sunday = 3:30am UTC Sunday
  cron.schedule('30 3 * * 0', () => {
    console.log('[cron] Firing weekly summary...')
    postWeeklySummary()
  }, { timezone: 'UTC' })

  // Monthly targets form — 1st of month at 7:00am IST = 1:30am UTC
  cron.schedule('30 1 1 * *', () => {
    console.log('[cron] Firing monthly targets request...')
    postTargetsRequest()
  }, { timezone: 'UTC' })

  // Top-250 re-ranker — Sunday 11:00pm IST = 5:30pm UTC Sunday
  cron.schedule('30 17 * * 0', () => {
    console.log('[cron] Firing Top-250 re-ranker...')
    runTop250Reranker()
  }, { timezone: 'UTC' })

  // End-of-month review — daily check at 6:00pm IST = 12:30pm UTC; fires when tomorrow is the 1st
  cron.schedule('30 12 * * *', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (tomorrow.getDate() === 1) {
      console.log('[cron] Firing end-of-month review...')
      postEndOfMonthReview()
    }
  }, { timezone: 'UTC' })

  console.log('📅 P0 tasks scheduled for 8:30am IST (3:00am UTC)')
  console.log('📅 Daily digest scheduled for 9:00am IST (3:30am UTC)')
  console.log('📅 Top-250 re-ranker scheduled for 11:00pm IST Sunday (5:30pm UTC)')
  console.log('📅 Monthly targets form scheduled for 7:00am IST on 1st of each month')
  console.log('📅 End-of-month review check scheduled daily at 6:00pm IST')
})

client.on('interactionCreate', async interaction => {
  // ── Autocomplete ────────────────────────────────────────────────
  if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
    const focused = interaction.options.getFocused(true)
    const query = focused.value.toLowerCase()

    try {
      // /mh p0 done — task autocomplete (today's open P0 tasks)
      if (interaction.commandName === 'mh' && focused.name === 'task' &&
          interaction.options.getSubcommand(false) === 'done') {
        const choices = cache.p0Tasks
          .filter(t => t.task.toLowerCase().includes(query))
          .slice(0, 25)
          .map(t => ({ name: t.task.slice(0, 100), value: t.linkedDeal }))
        return interaction.respond(choices)
      }

      // /mh log call — name autocomplete (searches leads or contacts based on selected type)
      if (interaction.commandName === 'mh' && focused.name === 'name') {
        const type = interaction.options.getString('type') // may be null if not yet selected

        if (!type || type === 'prospect') {
          const leadChoices = cache.leads
            .filter(l => {
              const full = `${l.firstName} ${l.lastName}`.toLowerCase()
              const company = (l.company || '').toLowerCase()
              return full.includes(query) || company.includes(query)
            })
            .slice(0, type ? 25 : 12)
            .map(l => ({
              name: `👤 ${l.firstName} ${l.lastName}${l.company ? ' — ' + l.company : ''}`.trim(),
              value: `prospect:${l.id}`,
            }))
          if (type === 'prospect') return interaction.respond(leadChoices)

          // No type selected yet — show both lists
          const contactChoices = cache.contacts
            .filter(c => {
              const full = `${c.firstName} ${c.lastName}`.toLowerCase()
              return full.includes(query) || (c.accountName || '').toLowerCase().includes(query)
            })
            .slice(0, 12)
            .map(c => ({
              name: `🏢 ${c.firstName} ${c.lastName}${c.accountName ? ' — ' + c.accountName : ''}`.trim(),
              value: `contact:${c.id}`,
            }))
          return interaction.respond([...leadChoices, ...contactChoices].slice(0, 25))
        }

        if (type === 'contact') {
          const choices = cache.contacts
            .filter(c => {
              const full = `${c.firstName} ${c.lastName}`.toLowerCase()
              return full.includes(query) || (c.accountName || '').toLowerCase().includes(query)
            })
            .slice(0, 25)
            .map(c => ({
              name: `🏢 ${c.firstName} ${c.lastName}${c.accountName ? ' — ' + c.accountName : ''}`.trim(),
              value: `contact:${c.id}`,
            }))
          return interaction.respond(choices)
        }

        return interaction.respond([])
      }

      // /mh log call — account autocomplete (Zoho Accounts, for override)
      if (interaction.commandName === 'mh' && focused.name === 'account') {
        const choices = cache.accounts
          .filter(a => a.accountName.toLowerCase().includes(query))
          .slice(0, 25)
          .map(a => ({ name: a.accountName, value: a.accountName }))
        return interaction.respond(choices)
      }

      // /book — account autocomplete (returns Zoho ID as value)
      if (focused.name === 'account') {
        const choices = cache.accounts
          .filter(a => a.accountName.toLowerCase().includes(query))
          .slice(0, 25)
          .map(a => ({ name: a.accountName, value: a.id }))
        return interaction.respond(choices)
      }

      if (focused.name === 'contact') {
        const choices = cache.contacts
          .filter(c => {
            const full = `${c.firstName} ${c.lastName}`.toLowerCase()
            return full.includes(query) || (c.email || '').toLowerCase().includes(query)
          })
          .slice(0, 25)
          .map(c => ({
            name: `${c.firstName} ${c.lastName}${c.email ? ' — ' + c.email : ''}`.trim(),
            value: c.id,
          }))
        return interaction.respond(choices)
      }

      if (focused.name === 'prospect') {
        const choices = cache.leads
          .filter(l => {
            const full = `${l.firstName} ${l.lastName}`.toLowerCase()
            const company = (l.company || '').toLowerCase()
            return full.includes(query) || company.includes(query) || (l.email || '').toLowerCase().includes(query)
          })
          .slice(0, 25)
          .map(l => ({
            name: `${l.firstName} ${l.lastName}${l.company ? ' — ' + l.company : ''}`.trim(),
            value: l.id,
          }))
        return interaction.respond(choices)
      }
    } catch (err) {
      console.error('Autocomplete error:', err)
      return interaction.respond([])
    }
  }

  if (!interaction.isChatInputCommand()) return

  // ── /book command ───────────────────────────────────────────────
  if (interaction.commandName === 'book') {
    await interaction.deferReply({ ephemeral: true })

    const accountId   = interaction.options.getString('account', true)
    const contactId   = interaction.options.getString('contact', true)
    const timeRaw     = interaction.options.getString('time', true)
    const meetingType = interaction.options.getString('type', true)

    const meetingTime = parseIST(timeRaw)
    if (!meetingTime) {
      return interaction.editReply(
        '❌ Invalid time format. Use `YYYY-MM-DD HH:MM` in IST, e.g. `2026-06-10 14:00`'
      )
    }

    try {
      const [accounts, contacts] = await Promise.all([
        vercelGet('/api/accounts'),
        vercelGet('/api/contacts'),
      ])

      const account = accounts.find(a => a.id === accountId)
      const contact = contacts.find(c => c.id === contactId)

      if (!account) return interaction.editReply('❌ Account not found — please re-select from the dropdown.')
      if (!contact) return interaction.editReply('❌ Contact not found — please re-select from the dropdown.')
      if (!contact.email) return interaction.editReply('❌ This contact has no email in Zoho CRM. Add an email first.')

      const res = await fetch(`${VERCEL_URL}/api/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: BASIC_AUTH,
        },
        body: JSON.stringify({
          accountId,
          accountName: account.accountName,
          contactId,
          contactName: `${contact.firstName} ${contact.lastName}`.trim(),
          contactEmail: contact.email,
          contactPhone: contact.phone || '',
          meetingTime,
          meetingType,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        return interaction.editReply(`❌ Booking failed: ${err}`)
      }

      const data = await res.json()
      const typeLabel = meetingType === 'L1' ? 'L1 — Discovery' : 'L2+ — Next Steps'
      const dateFormatted = new Date(meetingTime).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short',
      })

      await interaction.editReply(
        `✅ **Meeting booked!**\n` +
        `**Account:** ${account.accountName}\n` +
        `**Contact:** ${contact.firstName} ${contact.lastName} (${contact.email})\n` +
        `**Type:** ${typeLabel}\n` +
        `**Time (IST):** ${dateFormatted}\n` +
        `**G-Meet:** ${data.gMeetLink || '_(link in calendar invite)_'}\n` +
        `**Deal:** ${data.dealId ? `Created in Zoho CRM` : data.dealError ? `❌ ${data.dealError}` : 'Skipped (deal may already exist)'}`
      )
    } catch (err) {
      console.error('/book error:', err)
      await interaction.editReply(`❌ Unexpected error: ${err.message}`)
    }
  }

  // ── /book-prospect command ──────────────────────────────────────
  if (interaction.commandName === 'book-prospect') {
    await interaction.deferReply({ ephemeral: true })

    const leadId      = interaction.options.getString('prospect', true)
    const timeRaw     = interaction.options.getString('time', true)
    const meetingType = interaction.options.getString('type', true)

    const meetingTime = parseIST(timeRaw)
    if (!meetingTime) {
      return interaction.editReply(
        '❌ Invalid time format. Use `YYYY-MM-DD HH:MM` in IST, e.g. `2026-06-10 14:00`'
      )
    }

    try {
      const res = await fetch(`${VERCEL_URL}/api/book-prospect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: BASIC_AUTH,
        },
        body: JSON.stringify({ leadId, meetingTime, meetingType }),
      })

      if (!res.ok) {
        const err = await res.text()
        return interaction.editReply(`❌ Booking failed: ${err}`)
      }

      const data = await res.json()
      const typeLabel = meetingType === 'L1' ? 'L1 — Discovery' : 'L2+ — Next Steps'
      const dateFormatted = new Date(meetingTime).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short',
      })

      await interaction.editReply(
        `✅ **Meeting booked!**\n` +
        `**Prospect converted to Contact + Account**\n` +
        `**Type:** ${typeLabel}\n` +
        `**Time (IST):** ${dateFormatted}\n` +
        `**G-Meet:** ${data.gMeetLink || '_(link in calendar invite)_'}\n` +
        `**Deal:** ${data.dealId ? `Created in Zoho CRM` : data.dealError ? `❌ ${data.dealError}` : 'Skipped'}`
      )
    } catch (err) {
      console.error('/book-prospect error:', err)
      await interaction.editReply(`❌ Unexpected error: ${err.message}`)
    }
  }

  // ── /mh commands ────────────────────────────────────────────────
  if (interaction.commandName === 'mh') {
    const group = interaction.options.getSubcommandGroup(false)
    const sub   = interaction.options.getSubcommand(false)

    // ── /mh p0 done ─────────────────────────────────────────────
    if (group === 'p0' && sub === 'done') {
      await interaction.deferReply({ ephemeral: true })
      const linkedDeal = interaction.options.getString('task', true)

      // Find task label from cache for the confirmation message
      const taskEntry = cache.p0Tasks.find(t => t.linkedDeal === linkedDeal)
      const taskLabel = taskEntry ? taskEntry.task : linkedDeal

      try {
        await vercelPost('/api/p0-tasks/done', { linkedDeal })
        // Remove from cache immediately so it doesn't show in autocomplete again
        cache.p0Tasks = cache.p0Tasks.filter(t => t.linkedDeal !== linkedDeal)
        await interaction.editReply(`✅ **Done:** ${taskLabel}`)
      } catch (err) {
        console.error('/mh p0 done error:', err)
        await interaction.editReply(`❌ Failed to update task: ${err.message}`)
      }
      return
    }

    // ── /mh p0 today ────────────────────────────────────────────
    if (group === 'p0' && sub === 'today') {
      await interaction.deferReply({ ephemeral: true })
      try {
        const data = await vercelGet('/api/p0-tasks/open')
        const msg = buildSummaryMessage(data.tasks)
        const ch = interaction.client.channels.cache.find(c => c.name === 'p0-tasks')
        if (!ch) return interaction.editReply('❌ #p0-tasks channel not found.')
        const chunks = splitIntoChunks(msg)
        for (const chunk of chunks) await ch.send(chunk)
        await interaction.editReply(`✅ Posted to #p0-tasks (${data.tasks.length} open task${data.tasks.length !== 1 ? 's' : ''})`)
      } catch (err) {
        console.error('mh p0 today error:', err)
        await interaction.editReply(`❌ Failed: ${err.message}`)
      }
      return
    }

    // ── /mh p0 add ──────────────────────────────────────────────
    if (group === 'p0' && sub === 'add') {
      await interaction.deferReply({ ephemeral: true })
      const task       = interaction.options.getString('task', true)
      const detail     = interaction.options.getString('detail')      ?? ''
      const assignedTo = interaction.options.getString('assigned_to') ?? 'Anurag'
      const accountVal = interaction.options.getString('account')     ?? ''
      const contactVal = interaction.options.getString('contact')     ?? ''

      // Resolve display names from cache
      const accountName = accountVal
        ? (cache.accounts.find(a => a.id === accountVal || a.accountName === accountVal)?.accountName ?? accountVal)
        : ''
      const contactName = contactVal
        ? (() => { const c = cache.contacts.find(c => c.id === contactVal); return c ? `${c.firstName} ${c.lastName}`.trim() : contactVal })()
        : ''

      try {
        await vercelPost('/api/p0-tasks', { task, detail, assignedTo, account: accountName, contact: contactName })
        const lines = [`✅ **P0 task added**`, `**Task:** ${task}`]
        if (accountName) lines.push(`**Account:** ${accountName}`)
        if (contactName) lines.push(`**Contact:** ${contactName}`)
        if (detail) lines.push(`**Detail:** ${detail}`)
        lines.push(`**Assigned to:** ${assignedTo}`)
        await interaction.editReply(lines.join('\n'))
      } catch (err) {
        console.error('/mh p0 add error:', err)
        await interaction.editReply(`❌ Failed to add task: ${err.message}`)
      }
      return
    }

    // ── /mh stats weekly ────────────────────────────────────────
    if (group === 'stats' && sub === 'weekly') {
      await interaction.deferReply({ ephemeral: true })
      try {
        const data = await vercelPost('/api/weekly-summary', {})
        const statsChannel = interaction.client.channels.cache.find(c => c.name === 'stats')
        if (!statsChannel) return interaction.editReply('❌ #stats channel not found.')
        const lines = [
          `📊 **Weekly Summary — ${data.weekOf}**`,
          '',
          data.summary,
          '',
          `_Calls: ${data.stats.dialled} dialled · ${data.stats.connected} connected · ${data.stats.connectRate}% rate_`,
          `_Meetings: ${data.stats.l1Conducted} L1 · ${data.stats.l2Conducted} L2 conducted_`,
          `_Pipeline: ${data.stats.hotDeals} hot · ${data.stats.warmDeals} warm_`,
        ]
        const chunks = splitIntoChunks(lines.join('\n'))
        for (const chunk of chunks) await statsChannel.send(chunk)
        await interaction.editReply('✅ Weekly summary posted to #stats')
      } catch (err) {
        console.error('mh stats weekly error:', err)
        await interaction.editReply(`❌ Failed: ${err.message}`)
      }
      return
    }

    // ── /mh targets set ─────────────────────────────────────────────
    if (group === 'targets' && sub === 'set') {
      await interaction.deferReply({ ephemeral: true })
      const metric = interaction.options.getString('metric', true)
      const value  = interaction.options.getInteger('value', true)

      try {
        await vercelPost('/api/targets', { metricName: metric, targetValue: value })

        // Refresh the pinned message in #targets
        updatePinnedTargets().catch(err => console.error('[targets] Pin update failed:', err.message))

        await interaction.editReply(`✅ **Target set:** ${metric} = **${value}** for this month`)
      } catch (err) {
        console.error('/mh targets set error:', err)
        await interaction.editReply(`❌ Failed to set target: ${err.message}`)
      }
      return
    }

    // ── /mh targets view ────────────────────────────────────────────
    if (group === 'targets' && sub === 'view') {
      await interaction.deferReply({ ephemeral: true })
      try {
        const data = await vercelGet('/api/targets')
        const now = new Date()
        const monthLabel = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'long', year: 'numeric' })

        const lines = [`📊 **Targets — ${monthLabel}**`, '']
        for (const t of data.targets) {
          const pctStr = t.pct != null ? ` _(${t.pct}% of target)_` : ''
          const targetStr = t.target ? `${t.target}` : '—'
          lines.push(`• **${t.metric}:** ${t.actual} / ${targetStr}${pctStr}`)
        }
        await interaction.editReply(lines.join('\n'))
      } catch (err) {
        console.error('/mh targets view error:', err)
        await interaction.editReply(`❌ Failed: ${err.message}`)
      }
      return
    }

    // ── /mh sync-meetings ───────────────────────────────────────────
    if (!group && sub === 'sync-meetings') {
      await interaction.reply({
        content: [
          `ℹ️ **Circleback sync is webhook-driven — no manual trigger needed.**`,
          `Every meeting with a thetesttribe.com attendee automatically fires to the sync endpoint.`,
          `Meetings are marked **Conducted** in the Meetings sheet within seconds of Circleback processing them.`,
          `_If a meeting is missing: check Circleback → Automations to confirm the webhook is active._`,
        ].join('\n'),
        ephemeral: true,
      })
      return
    }

    // ── /mh briefing ────────────────────────────────────────────────
    if (!group && sub === 'briefing') {
      await interaction.deferReply({ ephemeral: true })
      try {
        const data = await vercelGet('/api/briefing')
        const message = buildBriefingMessage(data)
        const salesOps = interaction.client.channels.cache.find(c => c.name === 'general')
        if (!salesOps) return interaction.editReply('❌ #general channel not found.')
        const chunks = splitIntoChunks(message)
        for (const chunk of chunks) await salesOps.send(chunk)
        await interaction.editReply('✅ Briefing posted to #general')
      } catch (err) {
        console.error('/mh briefing error:', err)
        await interaction.editReply(`❌ Failed: ${err.message}`)
      }
      return
    }

    // ── /mh intel show ──────────────────────────────────────────────
    if (group === 'intel' && sub === 'show') {
      await interaction.deferReply({ ephemeral: true })
      const accountVal = interaction.options.getString('account', true)
      const account = cache.accounts.find(a => a.id === accountVal || a.accountName === accountVal)?.accountName ?? accountVal

      try {
        const data = await vercelGet('/api/account-intel')
        const normalise = s => s.toLowerCase().trim()
        const item = data.intel?.find(i => normalise(i.account) === normalise(account))
        if (!item) {
          return interaction.editReply(`❌ No intel found for **${account}**. Run \`/mh intel refresh\` to generate it.`)
        }

        const statusEmoji = { Won: '✅', Active: '🔥', Warm: '🟡', Cold: '🔵', Dead: '❌' }
        const summary = item.cumulativeSummary || item.circlebakIntelligence || item.summary || '—'
        const lines = [
          `${statusEmoji[item.status] ?? '⚪'} **${item.account}** — ${item.status}`,
          ``,
          summary,
          ``,
          item.nextAction ? `**→ Next:** ${item.nextAction}` : null,
          `_${item.meetingCount} meeting${item.meetingCount !== 1 ? 's' : ''} · last: ${item.lastMeeting?.slice(0, 10) ?? '—'} · updated: ${item.updatedAt?.slice(0, 10) ?? '—'}_`,
        ].filter(Boolean).join('\n')

        await interaction.editReply(lines)
      } catch (err) {
        console.error('/mh intel show error:', err)
        await interaction.editReply(`❌ Failed: ${err.message}`)
      }
      return
    }

    // ── /mh intel refresh ───────────────────────────────────────────
    if (group === 'intel' && sub === 'refresh') {
      await interaction.deferReply({ ephemeral: true })
      const accountVal = interaction.options.getString('account', true)
      const account = cache.accounts.find(a => a.id === accountVal || a.accountName === accountVal)?.accountName ?? accountVal

      try {
        const data = await vercelPost('/api/account-intel/refresh', { account })
        const item = data.intel
        const statusEmoji = { Won: '✅', Active: '🔥', Warm: '🟡', Cold: '🔵', Dead: '❌' }
        const summary = item.cumulativeSummary || item.circlebakIntelligence || '—'
        const lines = [
          `${statusEmoji[item.status] ?? '⚪'} **${item.account}** intel refreshed`,
          ``,
          summary,
          item.nextAction ? `**→ Next:** ${item.nextAction}` : null,
        ].filter(Boolean).join('\n')
        await interaction.editReply(lines)
      } catch (err) {
        console.error('/mh intel refresh error:', err)
        await interaction.editReply(`❌ Failed: ${err.message}`)
      }
      return
    }

    // ── /mh intel note ──────────────────────────────────────────────
    if (group === 'intel' && sub === 'note') {
      await interaction.deferReply({ ephemeral: true })
      const accountVal = interaction.options.getString('account', true)
      const text       = interaction.options.getString('text', true)
      const account    = cache.accounts.find(a => a.id === accountVal || a.accountName === accountVal)?.accountName ?? accountVal

      try {
        const data = await vercelPost('/api/account-intel/note', { account, note: text })
        const summary = data.cumulativeSummary?.slice(0, 300) ?? ''
        const lines = [
          `📝 **Note added to ${account}**`,
          `> ${text}`,
          summary ? `\n**Summary:** ${summary}` : null,
          data.nextAction ? `**→ Next:** ${data.nextAction}` : null,
        ].filter(Boolean).join('\n')
        await interaction.editReply(lines)
      } catch (err) {
        console.error('/mh intel note error:', err)
        await interaction.editReply(`❌ Failed: ${err.message}`)
      }
      return
    }

    // ── /mh intel status ────────────────────────────────────────────
    if (group === 'intel' && sub === 'status') {
      await interaction.deferReply({ ephemeral: true })
      const accountVal = interaction.options.getString('account', true)
      const status     = interaction.options.getString('status', true)
      const account    = cache.accounts.find(a => a.id === accountVal || a.accountName === accountVal)?.accountName ?? accountVal

      try {
        await vercelPost('/api/account-intel/status', { account, status })
        const statusEmoji = { Won: '✅', Active: '🔥', Warm: '🟡', Cold: '🔵', Dead: '❌' }
        await interaction.editReply(
          `${statusEmoji[status] ?? '⚪'} **${account}** status updated to **${status}**\n_Dashboard will reflect within 60 seconds._`
        )
      } catch (err) {
        console.error('/mh intel status error:', err)
        await interaction.editReply(`❌ Failed: ${err.message}`)
      }
      return
    }

    // ── /mh objective set ───────────────────────────────────────────
    if (group === 'objective' && sub === 'set') {
      await interaction.deferReply({ ephemeral: true })
      const objective = interaction.options.getString('name', true)
      const target    = interaction.options.getInteger('target', true)

      try {
        await vercelPost('/api/objectives', { objective, field: 'target', value: target })
        await interaction.editReply(
          `🎯 **Objective target set**\n**${objective}:** target = **${target}** for this month`
        )
      } catch (err) {
        console.error('/mh objective set error:', err)
        await interaction.editReply(`❌ Failed to set objective target: ${err.message}`)
      }
      return
    }

    // ── /mh objective update ─────────────────────────────────────────
    if (group === 'objective' && sub === 'update') {
      await interaction.deferReply({ ephemeral: true })
      const objective = interaction.options.getString('name', true)
      const current   = interaction.options.getInteger('current', true)

      try {
        await vercelPost('/api/objectives', { objective, field: 'current', value: current })
        await interaction.editReply(
          `📊 **Objective updated**\n**${objective}:** current = **${current}**\n_Dashboard will reflect the update within 60 seconds._`
        )
      } catch (err) {
        console.error('/mh objective update error:', err)
        await interaction.editReply(`❌ Failed to update objective: ${err.message}`)
      }
      return
    }

    // ── /mh log payment ─────────────────────────────────────────────
    if (group === 'log' && sub === 'payment') {
      await interaction.deferReply({ ephemeral: true })

      const accountVal  = interaction.options.getString('account', true)
      const amount      = interaction.options.getInteger('amount', true)
      const invoiceDate = interaction.options.getString('invoice_date', true)
      const dueDate     = interaction.options.getString('due_date', true)
      const deal        = interaction.options.getString('deal')  ?? ''
      const notes       = interaction.options.getString('notes') ?? ''

      if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        return interaction.editReply('❌ Dates must be in `YYYY-MM-DD` format, e.g. `2026-06-20`')
      }

      const account = cache.accounts.find(a => a.id === accountVal || a.accountName === accountVal)?.accountName ?? accountVal

      try {
        await vercelPost('/api/log-payment', { account, deal, amount, invoiceDate, dueDate, notes })

        const fmtAmt = amount >= 100000
          ? `₹${(amount / 100000).toFixed(2)}L`
          : `₹${amount.toLocaleString('en-IN')}`

        const lines = [
          `💰 **Payment logged**`,
          `**Account:** ${account}`,
          deal ? `**Deal:** ${deal}` : null,
          `**Amount:** ${fmtAmt}`,
          `**Invoice date:** ${invoiceDate}`,
          `**Due date:** ${dueDate}`,
          notes ? `**Notes:** ${notes}` : null,
          `_Status set to Invoiced. Update manually in Sheets when received._`,
        ].filter(Boolean).join('\n')

        await interaction.editReply(lines)
      } catch (err) {
        console.error('/mh log payment error:', err)
        await interaction.editReply(`❌ Failed to log payment: ${err.message}`)
      }
      return
    }

    if (group === 'log' && sub === 'call') {
      await interaction.deferReply()

      const nameValue   = interaction.options.getString('name', true)
      const outcome     = interaction.options.getString('outcome', true)
      const accountOvr  = interaction.options.getString('account')   ?? ''
      const phone       = interaction.options.getString('phone')     ?? ''
      const notes       = interaction.options.getString('notes')     ?? ''
      const followUpRaw = interaction.options.getString('follow_up') ?? ''

      if (followUpRaw && !/^\d{4}-\d{2}-\d{2}$/.test(followUpRaw)) {
        return interaction.editReply('❌ Follow-up date must be in `YYYY-MM-DD` format, e.g. `2026-06-09`')
      }

      // Decode name value — format is "prospect:<id>" or "contact:<id>"
      const colonIdx  = nameValue.indexOf(':')
      const nameType  = colonIdx !== -1 ? nameValue.slice(0, colonIdx) : ''
      const nameId    = colonIdx !== -1 ? nameValue.slice(colonIdx + 1) : ''

      let account = accountOvr
      let contactName = ''
      let contactPhone = phone

      if (nameType === 'prospect') {
        const lead = cache.leads.find(l => l.id === nameId)
        if (lead) {
          contactName = `${lead.firstName} ${lead.lastName}`.trim()
          if (!account) account = lead.company || contactName
        }
      } else if (nameType === 'contact') {
        const ct = cache.contacts.find(c => c.id === nameId)
        if (ct) {
          contactName = `${ct.firstName} ${ct.lastName}`.trim()
          if (!account) account = ct.accountName || contactName
          if (!contactPhone) contactPhone = ct.phone || ''
        }
      } else {
        // Typed manually (no autocomplete selection) — use raw value as contact name
        contactName = nameValue
      }

      const sdr = interaction.user.displayName || interaction.user.username

      try {
        await vercelPost('/api/log-call', {
          account,
          contactName,
          contactPhone,
          contactId: nameId || undefined,
          contactType: nameType === 'prospect' ? 'lead' : nameType === 'contact' ? 'contact' : undefined,
          sdr,
          outcome,
          notes,
          followUpDate: followUpRaw,
        })

        const outcomeLabel = OUTCOME_LABELS[outcome] ?? outcome
        const typeLabel = nameType === 'prospect' ? '👤 Prospect' : nameType === 'contact' ? '🏢 Contact' : ''
        const lines = [
          `📞 **Call logged** by ${sdr}`,
          `**${typeLabel || 'Person'}:** ${contactName || '—'}`,
          `**Account:** ${account || '—'}`,
        ]
        if (contactPhone) lines.push(`**Phone:** ${contactPhone}`)
        lines.push(`**Outcome:** ${outcomeLabel}`)
        if (followUpRaw) lines.push(`**Follow-up:** ${followUpRaw}`)
        if (notes) lines.push(`**Notes:** ${notes}`)

        await interaction.editReply(lines.join('\n'))
      } catch (err) {
        console.error('/mh log call error:', err)
        await interaction.editReply(`❌ Failed to log call: ${err.message}`)
      }
    }
  }
})

client.login(process.env.DISCORD_BOT_TOKEN)
