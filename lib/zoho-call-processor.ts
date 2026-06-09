import { getCallById, getContactById, getLeadById, updateLeadCompany, updateLeadStatus } from '@/lib/zoho'
import { appendCallRow, callExistsInSheetByZohoId, upsertContactIntelRow, updateProspectCallStatus, updateCallAccountRow } from '@/lib/sheets'
import { syncCallIntel } from '@/lib/intel'

const JUNK_ACCOUNT_NAMES = new Set([
  'discord bot', 'test1', 'test', 'test call', 'test account',
])

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'yahoo.in', 'yahoo.co.in',
  'hotmail.com', 'hotmail.co.in', 'outlook.com', 'live.com',
  'rediffmail.com', 'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me', 'aol.com', 'ymail.com',
])

function inferCompanyFromDomain(email: string): string {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain || FREE_EMAIL_DOMAINS.has(domain)) return ''
  const label = domain.split('.')[0]
  if (!label) return ''
  return label.length <= 4 ? label.toUpperCase() : label.charAt(0).toUpperCase() + label.slice(1)
}

function parseZohoDateTime(callStartTime: string): { date: string; time: string } {
  if (!callStartTime || callStartTime === 'null') return { date: '', time: '' }
  return { date: callStartTime.slice(0, 10), time: callStartTime.slice(11, 16) }
}

export function outcomeToLeadStatus(outcome: string): string | null {
  const o = outcome.toLowerCase().trim()
  if (o.includes('meeting scheduled') || o.includes('meeting booked') || o === 'scheduled a meeting') return 'Meeting Scheduled'
  if (['interested', 'connected', 'callback later', 'call back later', 'send more info'].includes(o)) return 'Contacted'
  if (o === 'not interested') return 'Not Interested'
  if (['no answer', 'voicemail', 'left voice message', 'busy', 'wrong number', 'rnr', 'not reachable', 'unanswered'].includes(o)) return 'Attempted to Contact'
  return null
}

export async function processZohoCall(callId: string, opts?: { existingRow?: { rowIndex: number; account: string } }): Promise<{
  ok: boolean
  callId: string
  account: string
  skippedSheetsWrite: boolean
  date: string
  error?: string
}> {
  const call = await getCallById(callId)
  if (!call) return { ok: false, callId, account: '', skippedSheetsWrite: false, date: '', error: `Call ${callId} not found in Zoho` }

  let contactName = ''
  let contactPhone = ''
  let email = ''
  let accountName = ''
  let leadIdForUpdate: string | null = null

  const whoId     = call.whoId
  const whatId    = call.whatId
  const whoModule  = (whoId?.module  ?? '').toLowerCase()
  const whatModule = (whatId?.module ?? '').toLowerCase()
  const seModule   = (call.seModule  ?? '').toLowerCase()

  const whoIsLead  = whoModule.includes('lead')  || seModule === 'leads'
  const whatIsLead = whatModule.includes('lead')

  if (whoIsLead && whoId?.id) {
    leadIdForUpdate = whoId.id
    const lead = await getLeadById(leadIdForUpdate)
    if (lead) { contactName = `${lead.firstName} ${lead.lastName}`.trim(); email = lead.email; contactPhone = lead.phone; accountName = lead.company }
    if (!contactName && whoId.name) contactName = whoId.name
  } else if ((whoIsLead || whatIsLead) && whatId?.id) {
    // Zoho sometimes places the lead in What_Id (not Who_Id) when $se_module=Leads
    leadIdForUpdate = whatId.id
    const lead = await getLeadById(leadIdForUpdate)
    if (lead) { contactName = `${lead.firstName} ${lead.lastName}`.trim(); email = lead.email; contactPhone = lead.phone; accountName = lead.company }
    if (!contactName && whatId.name) contactName = whatId.name
  } else if (whoId?.id) {
    const contact = await getContactById(whoId.id)
    if (contact) { contactName = `${contact.firstName} ${contact.lastName}`.trim(); email = contact.email; accountName = contact.accountName }
    if (!contactName && whoId.name) contactName = whoId.name
    if (!accountName && whatId?.name) accountName = whatId.name
  }

  if (!accountName && email) {
    accountName = inferCompanyFromDomain(email) || `Untagged Company #${callId.slice(-6).toUpperCase()}`
    if (!accountName.startsWith('Untagged') && leadIdForUpdate) {
      updateLeadCompany(leadIdForUpdate, accountName).catch(() => { /* best effort */ })
    }
  }
  if (!accountName) {
    accountName = `Untagged Company #${callId.slice(-6).toUpperCase()}`
  }

  if (JUNK_ACCOUNT_NAMES.has(accountName.toLowerCase().trim())) {
    return { ok: true, callId, account: accountName, skippedSheetsWrite: true, date: '' }
  }

  const { date, time } = parseZohoDateTime(call.callStartTime)
  const existingRow = opts?.existingRow ?? null
  const alreadyInSheets = existingRow ? true : await callExistsInSheetByZohoId(callId)

  if (!alreadyInSheets) {
    await appendCallRow({ date, time, account: accountName, contactName, contactPhone, sdr: call.ownerName, duration: call.callDuration, outcome: call.callResult, notes: call.description, followUpDate: '', zohoCallId: callId })
    console.log(`[zoho-call-processor] Wrote to Sheets — ${accountName} / ${call.callResult} / ${date}`)
  } else if (existingRow && existingRow.account.startsWith('Untagged Company') && !accountName.startsWith('Untagged Company')) {
    await updateCallAccountRow(existingRow.rowIndex, accountName, contactName, contactPhone)
    console.log(`[zoho-call-processor] Updated untagged row ${existingRow.rowIndex} — ${accountName}`)
  } else {
    console.log(`[zoho-call-processor] Skipped — ${callId} already in Sheets`)
  }

  if (accountName) syncCallIntel(accountName, date).catch(() => { /* best effort */ })

  const newLeadStatus = outcomeToLeadStatus(call.callResult)
  if (newLeadStatus) {
    if (leadIdForUpdate) updateLeadStatus(leadIdForUpdate, newLeadStatus).catch(() => { /* best effort */ })
    if (email) updateProspectCallStatus(email, newLeadStatus).catch(() => { /* best effort */ })
  }

  if (email) {
    upsertContactIntelRow(email, { date, time, outcome: call.callResult, notes: call.description, duration: call.callDuration, zohoCallId: callId }).catch(() => { /* best effort */ })
  }

  const wasUpdated = !!(existingRow && existingRow.account.startsWith('Untagged Company') && !accountName.startsWith('Untagged Company'))
  return { ok: true, callId, account: accountName, skippedSheetsWrite: alreadyInSheets && !wasUpdated, date }
}
