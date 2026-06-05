interface Props {
  label: string
  achieved: number
  target: number | null
  suffix?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function MetricCard({ label, achieved, target, suffix = '', size = 'md' }: Props) {
  const hit = target !== null && achieved >= target && target > 0

  const numSize = size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-2xl' : 'text-3xl'

  return (
    <div className="py-3">
      <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest">
        {label}
      </p>
      {target !== null && (
        <p className="text-xs text-mh-muted mt-0.5">
          Target: {target.toLocaleString()}{suffix}
        </p>
      )}
      <p
        className={`${numSize} font-semibold mt-1 transition-all ${
          hit ? 'text-mh-gold glow-gold' : 'text-mh-text'
        }`}
      >
        {achieved.toLocaleString()}{suffix}
      </p>
    </div>
  )
}
