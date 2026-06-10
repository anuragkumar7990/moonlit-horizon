import { getZohoAccounts, getContacts } from '@/lib/zoho'
import BookingForm from './BookingForm'

export const dynamic = 'force-dynamic'

export default async function BookPage({
  searchParams,
}: {
  searchParams: { account?: string }
}) {
  const [accounts, contacts] = await Promise.all([
    getZohoAccounts(),
    getContacts(),
  ])

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Book Contact</h1>
        <p className="text-slate-500 text-sm mt-1">
          Fills Google Calendar, Zoho CRM, and the dashboard automatically.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <BookingForm
          accounts={accounts}
          contacts={contacts}
          defaultAccount={searchParams.account}
        />
      </div>

      <p className="text-xs text-center text-slate-400 mt-4">
        You can also use <code className="bg-slate-100 px-1 rounded">/book meeting</code> in Discord for the same flow.
      </p>
    </div>
  )
}
