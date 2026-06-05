import { getLeads } from '@/lib/zoho'
import ProspectBookingForm from './ProspectBookingForm'

export const dynamic = 'force-dynamic'

export default async function BookProspectPage() {
  const leads = await getLeads()

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Book Meeting with Prospect</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Select a Prospect (Lead) — they will be automatically converted to a Contact and a meeting will be booked.
        </p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <ProspectBookingForm leads={leads} />
      </div>
    </div>
  )
}
