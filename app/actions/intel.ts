'use server'

import { revalidatePath } from 'next/cache'
import { appendManualNote, updateAccountStatus, type AccountIntelligence } from '@/lib/sheets'
import { regenerateCumulative } from '@/lib/intel'

export async function addManualNote(
  account: string,
  note: string
): Promise<{ updatedNotes: string; cumulativeSummary: string; nextAction: string }> {
  const updatedNotes = await appendManualNote(account, note)
  const { cumulativeSummary, nextAction } = await regenerateCumulative(account)
  revalidatePath('/view/anurag')
  return { updatedNotes, cumulativeSummary, nextAction }
}

export async function changeAccountStatus(
  account: string,
  status: string
): Promise<void> {
  await updateAccountStatus(account, status as AccountIntelligence['status'])
  revalidatePath('/view/anurag')
}
