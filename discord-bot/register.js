require('dotenv').config()
const { REST, Routes, SlashCommandBuilder } = require('discord.js')

const bookCommand = new SlashCommandBuilder()
  .setName('book')
  .setDescription('Book a meeting with a client')
  .addStringOption(opt =>
    opt.setName('account')
      .setDescription('Client account name')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(opt =>
    opt.setName('contact')
      .setDescription('Contact person at the account')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(opt =>
    opt.setName('time')
      .setDescription('Meeting time in IST — format: YYYY-MM-DD HH:MM (e.g. 2026-06-10 14:00)')
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('type')
      .setDescription('Meeting type')
      .setRequired(true)
      .addChoices(
        { name: 'L1 — Discovery', value: 'L1' },
        { name: 'L2+ — Next Steps', value: 'L2+' }
      )
  )

const bookProspectCommand = new SlashCommandBuilder()
  .setName('book-prospect')
  .setDescription('Convert a Prospect (Lead) and book a meeting')
  .addStringOption(opt =>
    opt.setName('prospect')
      .setDescription('Prospect name or company')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(opt =>
    opt.setName('time')
      .setDescription('Meeting time in IST — format: YYYY-MM-DD HH:MM (e.g. 2026-06-10 14:00)')
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('type')
      .setDescription('Meeting type')
      .setRequired(true)
      .addChoices(
        { name: 'L1 — Discovery', value: 'L1' },
        { name: 'L2+ — Next Steps', value: 'L2+' }
      )
  )

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN)
const clientId = process.env.DISCORD_CLIENT_ID
const guildId  = process.env.DISCORD_GUILD_ID

;(async () => {
  // 1. Clear all global commands
  console.log('Clearing global commands...')
  await rest.put(Routes.applicationCommands(clientId), { body: [] })
  console.log('Global commands cleared.')

  // 2. Register guild commands (instant, no propagation delay)
  console.log(`Registering guild commands for guild ${guildId}...`)
  await rest.put(
    Routes.applicationGuildCommands(clientId, guildId),
    { body: [bookCommand.toJSON(), bookProspectCommand.toJSON()] }
  )
  console.log('Done. /book and /book-prospect registered to guild.')
})()
