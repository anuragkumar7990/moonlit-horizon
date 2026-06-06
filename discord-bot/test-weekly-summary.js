require('dotenv').config()
const { Client, GatewayIntentBits } = require('discord.js')

const VERCEL_URL = process.env.VERCEL_URL
const BASIC_AUTH = 'Basic ' + Buffer.from(':' + process.env.DASHBOARD_PASSWORD).toString('base64')

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

bot.once('clientReady', async () => {
  try {
    console.log('Generating weekly summary via Vercel...')
    const res = await fetch(`${VERCEL_URL}/api/weekly-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('❌ API error:', data)
      process.exit(1)
    }

    console.log(`\nWeek: ${data.weekOf}`)
    console.log(`Stats: ${JSON.stringify(data.stats)}`)
    console.log('\n--- Summary ---\n' + data.summary + '\n---\n')

    const msg = [
      `📊 **Weekly Summary — ${data.weekOf}**`,
      '',
      data.summary,
      '',
      `_Calls: ${data.stats.dialled} dialled · ${data.stats.connected} connected · ${data.stats.connectRate}% rate_`,
      `_Meetings: ${data.stats.l1Conducted} L1 · ${data.stats.l2Conducted} L2 conducted_`,
      `_Pipeline: ${data.stats.hotDeals} hot · ${data.stats.warmDeals} warm_`,
    ].join('\n')

    const ch = bot.channels.cache.find(c => c.name === 'stats')
    if (!ch) {
      console.error('❌ #stats channel not found')
      process.exit(1)
    }
    const chunks = splitIntoChunks(msg)
    for (const chunk of chunks) await ch.send(chunk)
    console.log(`✅ Posted to #stats!`)
  } catch (e) {
    console.error('❌ Error:', e.message)
  }
  process.exit(0)
})

bot.login(process.env.DISCORD_BOT_TOKEN)
