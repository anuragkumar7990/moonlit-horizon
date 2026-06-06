require('dotenv').config()
const { Client, GatewayIntentBits } = require('discord.js')

const VERCEL_URL = process.env.VERCEL_URL
const BASIC_AUTH = 'Basic ' + Buffer.from(':' + process.env.DASHBOARD_PASSWORD).toString('base64')

const STAGE_GROUP = {
  'negotiation':               'followup',
  'payment pending':           'followup',
  'discovery call conducted':  'outline',
  'outline meeting conducted': 'proposal',
}

function dealLine(n, t) {
  const contact = t.contactName || '—'
  const account = t.accountName || '—'
  const topic   = t.dealName    || ''
  return `${n}. ${contact}, ${account} _(${t.stage})_${topic ? ' — ' + topic : ''}`
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

  const followup = stale.filter(t => STAGE_GROUP[(t.stage || '').toLowerCase()] === 'followup')
  const outline  = stale.filter(t => STAGE_GROUP[(t.stage || '').toLowerCase()] === 'outline')
  const proposal = stale.filter(t => STAGE_GROUP[(t.stage || '').toLowerCase()] === 'proposal')

  const lines = [`⚠️ **P0 Tasks — ${dateStr}** (${tasks.length} item${tasks.length !== 1 ? 's' : ''})`]

  if (followup.length > 0) {
    lines.push('', `**📞 Follow-up calls to be made (${followup.length})**`)
    followup.forEach((t, i) => lines.push(dealLine(i + 1, t)))
  }

  if (outline.length > 0) {
    lines.push('', `**📋 Outlines to be sent (${outline.length})**`)
    outline.forEach((t, i) => lines.push(dealLine(i + 1, t)))
  }

  if (proposal.length > 0) {
    lines.push('', `**📄 Proposals to be sent (${proposal.length})**`)
    proposal.forEach((t, i) => lines.push(dealLine(i + 1, t)))
  }

  if (others.length > 0) {
    lines.push('', `**🗂️ Others (${others.length})**`)
    others.forEach((t, i) => lines.push(`${i + 1}. ${t.task}${t.detail ? ' — _' + t.detail + '_' : ''}`))
  }

  if (callback.length > 0) {
    lines.push('', `**🔁 Overdue callbacks (${callback.length})**`)
    callback.forEach((t, i) => lines.push(`${i + 1}. ${t.task.replace('Overdue callback: ', '')} — _${t.detail}_`))
  }

  if (noNotes.length > 0) {
    lines.push('', `**📝 Meeting notes pending (${noNotes.length})**`)
    noNotes.forEach((t, i) => lines.push(`${i + 1}. ${t.task.replace('Add follow-up notes for ', '')} — _${t.detail}_`))
  }

  if (overdue.length > 0) {
    lines.push('', `**📅 Overdue closing dates (${overdue.length})**`)
    overdue.forEach((t, i) => lines.push(`${i + 1}. ${t.task.replace('Closing date overdue: ', '')} — _${t.detail}_`))
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

const bot = new Client({ intents: [GatewayIntentBits.Guilds] })

bot.once('ready', async () => {
  try {
    console.log('Fetching P0 tasks from Vercel...')
    const res = await fetch(`${VERCEL_URL}/api/p0-tasks`, {
      headers: { Authorization: BASIC_AUTH },
    })
    const data = await res.json()
    console.log(`Got ${data.newCount} new tasks. Building message...`)

    const msg = buildP0Message(data)
    console.log('\n--- Message preview ---\n' + msg + '\n---\n')

    const ch = bot.channels.cache.find(c => c.name === 'p0-tasks')
    if (!ch) {
      console.error('❌ #p0-tasks channel not found — create it in Discord first')
      process.exit(1)
    }
    const chunks = splitIntoChunks(msg)
    for (const chunk of chunks) await ch.send(chunk)
    console.log(`✅ Posted to #p0-tasks! (${chunks.length} message${chunks.length > 1 ? 's' : ''})`)
  } catch (e) {
    console.error('❌ Error:', e.message)
  }
  process.exit(0)
})

bot.login(process.env.DISCORD_BOT_TOKEN)
