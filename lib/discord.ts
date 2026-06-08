const DISCORD_API = 'https://discord.com/api/v10'

// Posts a message to a Discord channel by name, using the bot token already in Vercel env.
// Fire-and-forget safe — errors are logged but never thrown.
export async function postToDiscordChannel(channelName: string, content: string): Promise<void> {
  const token   = process.env.DISCORD_BOT_TOKEN
  const guildId = process.env.DISCORD_GUILD_ID || '1504972620083499199'
  if (!token) { console.warn('[discord] DISCORD_BOT_TOKEN not set'); return }

  try {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${token}` },
      cache: 'no-store',
    })
    const channels = await res.json() as { id: string; name: string; type: number }[]
    const channel = channels.find(c => c.name === channelName)
    if (!channel) { console.error(`[discord] Channel #${channelName} not found in guild ${guildId}`); return }

    await fetch(`${DISCORD_API}/channels/${channel.id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.slice(0, 2000) }),
    })
  } catch (e) {
    console.error('[discord] postToDiscordChannel failed:', (e as Error).message)
  }
}
