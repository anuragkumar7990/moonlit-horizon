import { appendSyncError } from './sheets'
import { sendAlertEmail } from './email'

// Single entry point for surfacing a background/fire-and-forget sync failure — replaces the
// old pattern of `.catch(e => console.error(...))`, which left failures invisible once the
// serverless function exited. Logs to the Sync_Errors Sheets tab (always) and emails
// SYNC_ALERT_EMAIL_TO (only if that env var is set — unset by default so this can't start
// sending real email before the owner explicitly opts in, same gating philosophy as
// tribeqonf-2026's COMMS_LAUNCHED switch). Never throws.
export async function notifySyncError(operation: string, context: string, error: unknown): Promise<void> {
  await appendSyncError(operation, context, error)

  const to = process.env.SYNC_ALERT_EMAIL_TO
  if (!to) return

  const message = error instanceof Error ? error.message : String(error)
  await sendAlertEmail(
    to,
    `Moonlit Horizon sync error: ${operation}`,
    `Operation: ${operation}\nContext: ${context}\nError: ${message}\nTime: ${new Date().toISOString()}`
  )
}
