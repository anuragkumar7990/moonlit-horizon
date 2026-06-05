require('dotenv').config()
const { Client, GatewayIntentBits, InteractionType } = require('discord.js')

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

// Parse "YYYY-MM-DD HH:MM" as IST
function parseIST(str) {
  const clean = str.trim()
  // Accept YYYY-MM-DD HH:MM or YYYY-MM-DDTHH:MM
  const normalised = clean.replace('T', ' ')
  const m = normalised.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/)
  if (!m) return null
  return `${m[1]}T${m[2]}:00+05:30`
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

client.on('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`)
})

client.on('interactionCreate', async interaction => {
  // ── Autocomplete ────────────────────────────────────────────────
  if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
    const focused = interaction.options.getFocused(true)

    try {
      if (focused.name === 'account') {
        const accounts = await vercelGet('/api/accounts')
        const query = focused.value.toLowerCase()
        const choices = accounts
          .filter(a => a.accountName.toLowerCase().includes(query))
          .slice(0, 25)
          .map(a => ({ name: a.accountName, value: a.id }))
        return interaction.respond(choices)
      }

      if (focused.name === 'contact') {
        const contacts = await vercelGet('/api/contacts')
        const query = focused.value.toLowerCase()
        const choices = contacts
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
    } catch (err) {
      console.error('Autocomplete error:', err)
      return interaction.respond([])
    }
  }

  // ── /book command ───────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === 'book') {
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
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short',
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
})

client.login(process.env.DISCORD_BOT_TOKEN)
