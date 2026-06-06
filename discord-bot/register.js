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

const mhCommand = new SlashCommandBuilder()
  .setName('mh')
  .setDescription('Moonlit Horizon — sales ops commands')
  .addSubcommandGroup(group =>
    group
      .setName('p0')
      .setDescription('P0 task management')
      .addSubcommand(sub =>
        sub
          .setName('add')
          .setDescription('Add a manual P0 task to today\'s list')
          .addStringOption(opt =>
            opt.setName('task')
              .setDescription('What needs to be done')
              .setRequired(true)
          )
          .addStringOption(opt =>
            opt.setName('detail')
              .setDescription('Additional context (account, deadline, etc.)')
              .setRequired(false)
          )
          .addStringOption(opt =>
            opt.setName('assigned_to')
              .setDescription('Who should action this')
              .setRequired(false)
              .addChoices(
                { name: 'Anurag',   value: 'Anurag'   },
                { name: 'Tanishq',  value: 'Tanishq'  },
                { name: 'Ashutosh', value: 'Ashutosh' },
                { name: 'Mahesh',   value: 'Mahesh'   },
              )
          )
          .addStringOption(opt =>
            opt.setName('account')
              .setDescription('Link to a deal/account (optional)')
              .setRequired(false)
              .setAutocomplete(true)
          )
          .addStringOption(opt =>
            opt.setName('contact')
              .setDescription('Link to a contact (optional)')
              .setRequired(false)
              .setAutocomplete(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('done')
          .setDescription('Mark a P0 task as done')
          .addStringOption(opt =>
            opt.setName('task')
              .setDescription('Select the task to mark done')
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('today')
          .setDescription('Re-post today\'s open P0 tasks to #p0-tasks')
      )
  )
  .addSubcommandGroup(group =>
    group
      .setName('stats')
      .setDescription('Reports and summaries')
      .addSubcommand(sub =>
        sub
          .setName('weekly')
          .setDescription('Generate and post this week\'s LLM summary to #stats')
      )
  )
  .addSubcommandGroup(group =>
    group
      .setName('targets')
      .setDescription('Monthly target management')
      .addSubcommand(sub =>
        sub
          .setName('set')
          .setDescription('Set a monthly target for a metric')
          .addStringOption(opt =>
            opt.setName('metric')
              .setDescription('Which metric to set')
              .setRequired(true)
              .addChoices(
                { name: 'Calls Dialled',         value: 'Calls Dialled'         },
                { name: 'Calls Connected',        value: 'Calls Connected'       },
                { name: 'Meetings Booked',        value: 'Meetings Booked'       },
                { name: 'L1 Meetings Conducted',  value: 'L1 Meetings Conducted' },
                { name: 'L2 Meetings Conducted',  value: 'L2 Meetings Conducted' },
              )
          )
          .addIntegerOption(opt =>
            opt.setName('value')
              .setDescription('Monthly target number')
              .setRequired(true)
              .setMinValue(1)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('view')
          .setDescription('View current month\'s targets and actuals')
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('briefing')
      .setDescription('Post today\'s briefing to #sales-ops: P0 tasks + meetings + hot pipeline')
  )
  .addSubcommand(sub =>
    sub
      .setName('sync-meetings')
      .setDescription('Sync Circleback notes → mark L1/L2 meetings as Conducted in the Meetings sheet')
  )
  .addSubcommandGroup(group =>
    group
      .setName('log')
      .setDescription('Log sales activity')
      .addSubcommand(sub =>
        sub
          .setName('call')
          .setDescription('Log a call you just made')
          .addStringOption(opt =>
            opt.setName('type')
              .setDescription('Are you calling a prospect (cold lead) or an existing contact?')
              .setRequired(true)
              .addChoices(
                { name: '👤 Prospect — cold lead',        value: 'prospect' },
                { name: '🏢 Contact — existing client',   value: 'contact'  },
              )
          )
          .addStringOption(opt =>
            opt.setName('name')
              .setDescription('Name — select type first, then search here')
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addStringOption(opt =>
            opt.setName('outcome')
              .setDescription('How did the call go?')
              .setRequired(true)
              .addChoices(
                { name: '✅ Meeting Booked',             value: 'meeting booked'   },
                { name: '✅ Connected — Interested',     value: 'connected'        },
                { name: '✅ Connected — Not Interested', value: 'not interested'   },
                { name: '✅ Connected — Callback Later', value: 'callback later'   },
                { name: '✅ Connected — Send More Info', value: 'send more info'   },
                { name: '📵 No Answer',                 value: 'no answer'        },
                { name: '📵 Voicemail',                 value: 'voicemail'        },
                { name: '📵 Busy',                      value: 'busy'             },
                { name: '📵 Wrong Number',              value: 'wrong number'     },
              )
          )
          .addStringOption(opt =>
            opt.setName('account')
              .setDescription('Company / account name (auto-filled, can override)')
              .setRequired(false)
              .setAutocomplete(true)
          )
          .addStringOption(opt =>
            opt.setName('phone')
              .setDescription('Phone number called (optional override)')
              .setRequired(false)
          )
          .addStringOption(opt =>
            opt.setName('notes')
              .setDescription('Notes from the call (optional)')
              .setRequired(false)
          )
          .addStringOption(opt =>
            opt.setName('follow_up')
              .setDescription('Follow-up date in YYYY-MM-DD format (optional)')
              .setRequired(false)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('payment')
          .setDescription('Log an invoice / payment for a client deal')
          .addStringOption(opt =>
            opt.setName('account')
              .setDescription('Client account name')
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addIntegerOption(opt =>
            opt.setName('amount')
              .setDescription('Invoice amount in INR (without GST)')
              .setRequired(true)
              .setMinValue(1)
          )
          .addStringOption(opt =>
            opt.setName('invoice_date')
              .setDescription('Invoice date — YYYY-MM-DD (e.g. 2026-06-06)')
              .setRequired(true)
          )
          .addStringOption(opt =>
            opt.setName('due_date')
              .setDescription('Payment due date — YYYY-MM-DD (e.g. 2026-06-20)')
              .setRequired(true)
          )
          .addStringOption(opt =>
            opt.setName('deal')
              .setDescription('Deal / training description (optional)')
              .setRequired(false)
          )
          .addStringOption(opt =>
            opt.setName('notes')
              .setDescription('Any additional notes (optional)')
              .setRequired(false)
          )
      )
  )
  .addSubcommandGroup(group =>
    group
      .setName('intel')
      .setDescription('Account intelligence')
      .addSubcommand(sub =>
        sub
          .setName('show')
          .setDescription('Show account intelligence for a client')
          .addStringOption(opt =>
            opt.setName('account')
              .setDescription('Client account name')
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('refresh')
          .setDescription('Regenerate intel for one account from its Notes tab history')
          .addStringOption(opt =>
            opt.setName('account')
              .setDescription('Client account name')
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('note')
          .setDescription('Append a manual note to an account')
          .addStringOption(opt =>
            opt.setName('account')
              .setDescription('Client account name')
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addStringOption(opt =>
            opt.setName('text')
              .setDescription('Note to append (timestamped automatically)')
              .setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('status')
          .setDescription('Update the deal status for an account')
          .addStringOption(opt =>
            opt.setName('account')
              .setDescription('Client account name')
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addStringOption(opt =>
            opt.setName('status')
              .setDescription('New status')
              .setRequired(true)
              .addChoices(
                { name: 'Won — training delivered',                value: 'Won'    },
                { name: 'Active — pricing/scheduling agreed',      value: 'Active' },
                { name: 'Warm — interested, follow-ups ongoing',   value: 'Warm'   },
                { name: 'Cold — blocked by budget/approval',       value: 'Cold'   },
                { name: 'Dead — no fit or ghosted',                value: 'Dead'   },
              )
          )
      )
  )
  .addSubcommandGroup(group =>
    group
      .setName('objective')
      .setDescription('Monthly objective tracking')
      .addSubcommand(sub =>
        sub
          .setName('set')
          .setDescription('Set a monthly target for an objective')
          .addStringOption(opt =>
            opt.setName('name')
              .setDescription('Which objective to set a target for')
              .setRequired(true)
              .addChoices(
                { name: 'Prospects Uploaded',    value: 'Prospects Uploaded'    },
                { name: 'Calls Dialled',         value: 'Calls Dialled'         },
                { name: 'L1 Meetings Conducted', value: 'L1 Meetings Conducted' },
                { name: 'Deals Won',             value: 'Deals Won'             },
                { name: 'Trainers Onboarded',    value: 'Trainers Onboarded'    },
                { name: 'Revenue Invoiced (₹K)', value: 'Revenue Invoiced (₹K)' },
                { name: 'Topic Coverage (%)',    value: 'Topic Coverage (%)'    },
              )
          )
          .addIntegerOption(opt =>
            opt.setName('target')
              .setDescription('Monthly target value')
              .setRequired(true)
              .setMinValue(0)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('update')
          .setDescription('Update current progress for an objective')
          .addStringOption(opt =>
            opt.setName('name')
              .setDescription('Which objective to update')
              .setRequired(true)
              .addChoices(
                { name: 'Prospects Uploaded',    value: 'Prospects Uploaded'    },
                { name: 'Calls Dialled',         value: 'Calls Dialled'         },
                { name: 'L1 Meetings Conducted', value: 'L1 Meetings Conducted' },
                { name: 'Deals Won',             value: 'Deals Won'             },
                { name: 'Trainers Onboarded',    value: 'Trainers Onboarded'    },
                { name: 'Revenue Invoiced (₹K)', value: 'Revenue Invoiced (₹K)' },
                { name: 'Topic Coverage (%)',    value: 'Topic Coverage (%)'    },
              )
          )
          .addIntegerOption(opt =>
            opt.setName('current')
              .setDescription('Current value (replaces previous progress)')
              .setRequired(true)
              .setMinValue(0)
          )
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
    { body: [bookCommand.toJSON(), bookProspectCommand.toJSON(), mhCommand.toJSON()] }
  )
  console.log('Done. /book, /book-prospect, and /mh registered to guild.')
})()
