import PersonSelector from '@/components/PersonSelector'

export default function AshutoshView() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <PersonSelector />
      </div>
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 rounded-full bg-mh-surface border-2 border-mh-vermillion flex items-center justify-center text-2xl font-semibold text-mh-vermillion mb-4">
          A
        </div>
        <h1 className="text-xl font-semibold text-mh-text">Ashutosh&apos;s View</h1>
        <p className="text-mh-muted text-sm mt-2">Building in Phase 1b</p>
        <p className="text-mh-muted text-xs mt-1">Prospect DB health · Email status · Pipeline · Objectives</p>
      </div>
    </div>
  )
}
