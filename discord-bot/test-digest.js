require('dotenv').config()
const { Client, GatewayIntentBits } = require('discord.js')

const VERCEL_URL = process.env.VERCEL_URL
const BASIC_AUTH = 'Basic ' + Buffer.from(':' + process.env.DASHBOARD_PASSWORD).toString('base64')

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

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

  const connRate = d.dialled.achieved > 0
    ? ` (${Math.round((d.connected.achieved / d.dialled.achieved) * 100)}%)`
    : ''

  const lines = [
    `📊 **Daily Stats — ${dateStr}**`,
    '',
    '**📞 Calls Today**',
    `Dialled: ${fmtStat(d.dialled.achieved, d.dialled.target)} · Connected: ${fmtStat(d.connected.achieved, d.connected.target)}${connRate} · Booked: ${fmtStat(d.meetingsBooked.achieved, d.meetingsBooked.target)}`,
    '',
    '**📅 This Week**',
    `Calls: **${w.dialled.achieved}** dialled / ${w.dialled.target ?? '—'} · **${w.connected.achieved}** connected / ${w.connected.target ?? '—'}`,
    `Meetings: **${mw.l1Booked}** L1 booked / ${mwt.l1Booked ?? '—'} · **${mw.l1Conducted}** L1 conducted / ${mwt.l1Conducted ?? '—'} · **${mw.l2Conducted}** L2`,
  ]

  if (todayMeetings > 0) {
    lines.push(`📆 **Meetings today:** ${todayMeetings}`)
  }

  lines.push(
    '',
    '**🔥 Pipeline**',
    `🔴 Hot: **${leads.hot}** · 🟡 Warm: **${leads.warm}** · 🔵 Cold: **${leads.cold}** · Total: **${leads.total}**`,
  )

  if (funnel.stages.length > 0) {
    const stageStr = funnel.stages
      .map(s => `${s.stage.replace('Discovery Call', 'DC')}: **${s.count}**`)
      .join(' · ')
    lines.push('', '**🔄 Funnel**', stageStr)
  }

  if (funnel.won.count > 0 || funnel.lost.count > 0) {
    lines.push(`✅ Won: **${funnel.won.count}** (${fmtAmount(funnel.won.amount)}) · ❌ Lost: **${funnel.lost.count}**`)
  }

  return lines.join('\n')
}

const bot = new Client({ intents: [GatewayIntentBits.Guilds] })

bot.once('ready', async () => {
  try {
    console.log('Fetching stats from Vercel...')
    const res = await fetch(`${VERCEL_URL}/api/stats-digest`, {
      headers: { Authorization: BASIC_AUTH },
    })
    const data = await res.json()
    console.log('Got data. Building message...')

    const msg = buildDigestMessage(data)
    console.log('\n--- Message preview ---\n' + msg + '\n---\n')

    const ch = bot.channels.cache.find(c => c.name === 'stats')
    if (!ch) {
      console.error('❌ #stats channel not found')
      process.exit(1)
    }
    await ch.send(msg)
    console.log('✅ Posted to #stats!')
  } catch (e) {
    console.error('❌ Error:', e.message)
  }
  process.exit(0)
})

bot.login(process.env.DISCORD_BOT_TOKEN)
