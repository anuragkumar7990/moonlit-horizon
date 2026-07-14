import { getCallById, getContactById, getLeadById, findLeadByEmail, updateLeadCompany, updateLeadStatus, findDealByName, createDealLight } from '@/lib/zoho'
import { appendCallRow, callExistsInSheetByZohoId, upsertContactIntelRow, updateProspectCallStatus, updateCallAccountRow, getProspectByEmail } from '@/lib/sheets'
import { syncCallIntel } from '@/lib/intel'
import { toTitleCase, isJunkAccountName, isJunkCallResult, resolveFallbackAccountName } from '@/lib/company-resolution'
import { notifySyncError } from '@/lib/sync-errors'

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

export async function processZohoCall(callId: string, opts?: { existingRow?: { rowIndex: number; account: string; contactName?: string }; intelSyncedAccounts?: Set<string> }): Promise<{
  ok: boolean
  callId: string
  account: string
  skippedSheetsWrite: boolean
  scheduledCall: boolean   // true if Zoho status is not Completed — caller should delete the sheet row
  date: string
  error?: string
}> {
  const call = await getCallById(callId)
  if (!call) return { ok: false, callId, account: '', skippedSheetsWrite: false, scheduledCall: false, date: '', error: `Call ${callId} not found in Zoho` }

  // Skip planned/scheduled activities — only process calls that were actually dialled
  const callStatus = call.callStatus.toLowerCase()
  if (callStatus && callStatus !== 'completed') {
    return { ok: true, callId, account: '', skippedSheetsWrite: true, scheduledCall: true, date: '' }
  }

  // Skip calls auto-processed by Zoho AI telephony — not real SDR dials
  if (isJunkCallResult(call.callResult)) {
    return { ok: true, callId, account: '', skippedSheetsWrite: true, scheduledCall: true, date: '' }
  }

  let contactName = ''
  let contactPhone = ''
  let email = ''
  let designation = ''
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
    if (lead) { contactName = `${lead.firstName} ${lead.lastName}`.trim(); email = lead.email; contactPhone = lead.phone; accountName = toTitleCase(lead.company); designation = lead.designation }
    if (!contactName && whoId.name) contactName = whoId.name
  } else if ((whoIsLead || whatIsLead) && whatId?.id) {
    // Zoho sometimes places the lead in What_Id (not Who_Id) when $se_module=Leads
    leadIdForUpdate = whatId.id
    const lead = await getLeadById(leadIdForUpdate)
    if (lead) { contactName = `${lead.firstName} ${lead.lastName}`.trim(); email = lead.email; contactPhone = lead.phone; accountName = toTitleCase(lead.company); designation = lead.designation }
    if (!contactName && whatId.name) contactName = whatId.name
  } else if (whoId?.id) {
    const contact = await getContactById(whoId.id)
    if (contact) { contactName = `${contact.firstName} ${contact.lastName}`.trim(); email = contact.email; accountName = toTitleCase(contact.accountName); designation = contact.designation }
    if (!contactName && whoId.name) contactName = whoId.name
    if (!accountName && whatId?.name) accountName = whatId.name
  } else if (seModule === 'accounts' && whatId?.name) {
    // Call logged against an Account record directly — grab name from What_Id
    accountName = whatId.name
  }

  // Enrich missing fields from Prospects sheet (Zoho leads often lack Company/Designation)
  if (email && (!accountName || !designation || !contactPhone)) {
    const prospect = await getProspectByEmail(email).catch(() => null)
    if (prospect) {
      if (!designation && prospect.designation)   designation   = prospect.designation
      if (!contactPhone && prospect.phone)         contactPhone  = prospect.phone
      if (!accountName  && prospect.company)       accountName   = toTitleCase(prospect.company)
      if (!contactName  && (prospect.firstName || prospect.lastName)) {
        contactName = `${prospect.firstName} ${prospect.lastName}`.trim()
      }
    }
  }

  // If still no company, try to find a Zoho Lead for this email (covers Contact-linked calls where
  // the same person was uploaded as a Lead with company data)
  if (!accountName && email) {
    const leadId = await findLeadByEmail(email).catch(() => null)
    if (leadId) {
      const lead = await getLeadById(leadId).catch(() => null)
      if (lead?.company) accountName = toTitleCase(lead.company)
    }
  }

  if (!accountName) {
    accountName = resolveFallbackAccountName(email, callId)
    if (!accountName.startsWith('Untagged') && leadIdForUpdate) {
      updateLeadCompany(leadIdForUpdate, accountName).catch(e => notifySyncError('updateLeadCompany', `leadId=${leadIdForUpdate} accountName=${accountName}`, e))
    }
  }

  if (isJunkAccountName(accountName)) {
    return { ok: true, callId, account: accountName, skippedSheetsWrite: true, scheduledCall: false, date: '' }
  }

  const { date, time } = parseZohoDateTime(call.callStartTime)
  const existingRow = opts?.existingRow ?? null
  const alreadyInSheets = existingRow ? true : await callExistsInSheetByZohoId(callId)

  // A row needs updating if: it was untagged and now has a real company, OR
  // it was written without a contact name (empty contactName = stale/incomplete row from old sync code).
  const isIncompleteRow = existingRow && !existingRow.contactName && contactName
  const wasUntagged = existingRow && existingRow.account.startsWith('Untagged Company') && !accountName.startsWith('Untagged Company')

  let intelNeedsUpdate = false
  if (!alreadyInSheets) {
    await appendCallRow({ date, time, account: accountName, contactName, contactPhone, email, designation, sdr: call.ownerName, duration: call.callDuration, outcome: call.callResult, notes: call.description, followUpDate: '', zohoCallId: callId })
    console.log(`[zoho-call-processor] Wrote to Sheets — ${accountName} / ${call.callResult} / ${date}`)
    intelNeedsUpdate = true
  } else if (wasUntagged || isIncompleteRow) {
    await updateCallAccountRow(existingRow!.rowIndex, accountName, contactName, contactPhone, email, designation, call.callDuration || undefined)
    console.log(`[zoho-call-processor] Updated row ${existingRow!.rowIndex} — ${accountName} (wasUntagged=${wasUntagged} isIncomplete=${!!isIncompleteRow})`)
    // Only update intel if the company name actually changed (wasUntagged); outcome didn't change for isIncompleteRow
    if (wasUntagged) intelNeedsUpdate = true
  } else {
    console.log(`[zoho-call-processor] Skipped — ${callId} already in Sheets`)
  }

  if (intelNeedsUpdate && accountName && !accountName.startsWith('Untagged Company')) {
    // Dedup: if caller passes a Set, only fire intel sync once per account per run
    const alreadySynced = opts?.intelSyncedAccounts
    if (!alreadySynced || !alreadySynced.has(accountName)) {
      syncCallIntel(accountName, date).catch(e => notifySyncError('syncCallIntel', `account=${accountName} date=${date}`, e))
      alreadySynced?.add(accountName)
    }
  }

  const newLeadStatus = outcomeToLeadStatus(call.callResult)
  if (newLeadStatus) {
    if (leadIdForUpdate) updateLeadStatus(leadIdForUpdate, newLeadStatus).catch(e => notifySyncError('updateLeadStatus', `leadId=${leadIdForUpdate} status=${newLeadStatus}`, e))
    if (email) updateProspectCallStatus(email, newLeadStatus).catch(e => notifySyncError('updateProspectCallStatus', `email=${email} status=${newLeadStatus}`, e))
  }

  if (newLeadStatus === 'Meeting Scheduled' && accountName && !accountName.startsWith('Untagged')) {
    const closingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    findDealByName(accountName)
      .then(exists => {
        if (!exists) {
          return createDealLight(accountName, 'Discovery Call booked', closingDate)
            .then(id => console.log(`[zoho-call-processor] Created deal for ${accountName} (id=${id})`))
        }
        console.log(`[zoho-call-processor] Deal already exists for ${accountName}, skipping`)
      })
      .catch(e => notifySyncError('createDealLight', `account=${accountName}`, e))
  }

  if (email) {
    upsertContactIntelRow(email, { date, time, outcome: call.callResult, notes: call.description, duration: call.callDuration, zohoCallId: callId })
      .catch(e => notifySyncError('upsertContactIntelRow', `email=${email}`, e))
  }

  const wasUpdated = !!(wasUntagged || isIncompleteRow)
  return { ok: true, callId, account: accountName, skippedSheetsWrite: alreadyInSheets && !wasUpdated, scheduledCall: false, date }
}
