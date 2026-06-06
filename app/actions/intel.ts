'use server'

import { revalidatePath } from 'next/cache'
import { appendManualNote, updateAccountStatus, updateLastContactDate, type AccountIntelligence } from '@/lib/sheets'
import { regenerateCumulative } from '@/lib/intel'

export async function addManualNote(
  account: string,
  note: string
): Promise<{ updatedNotes: string; cumulativeSummary: string; nextAction: string; lastContactDate: string }> {
  const updatedNotes = await appendManualNote(account, note)
  const { cumulativeSummary, nextAction, lastContactDate } = await regenerateCumulative(account, 'notes')
  revalidatePath('/view/anurag')
  return { updatedNotes, cumulativeSummary, nextAction, lastContactDate: lastContactDate ?? '' }
}

export async function changeAccountStatus(
  account: string,
  status: string
): Promise<void> {
  await updateAccountStatus(account, status as AccountIntelligence['status'])
  revalidatePath('/view/anurag')
}

export async function updateLastContact(
  account: string,
  date: string
): Promise<void> {
  await updateLastContactDate(account, date)
  revalidatePath('/view/anurag')
}
