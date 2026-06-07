interface Props {
  label: string
  achieved: number
  target: number | null
  suffix?: string
  size?: 'sm' | 'md' | 'lg'
  accent?: string
}

export default function MetricCard({ label, achieved, target, suffix = '', size = 'md', accent = '#E8341C' }: Props) {
  const hit = target !== null && achieved >= target && target > 0
  const pct = target !== null && target > 0 ? Math.min((achieved / target) * 100, 100) : null

  const numSize = size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-2xl' : 'text-3xl'

  const glowColor = hit ? '#FFD700' : accent
  const barColor  = hit
    ? 'linear-gradient(90deg, #FFD700, #FFF176)'
    : `linear-gradient(90deg, ${accent}, ${accent}CC)`

  return (
    <div className="py-3 pl-3 relative"
      style={{ borderLeft: `2px solid ${glowColor}22` }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: accent }}
      >
        {label}
      </p>

      <p
        className={`${numSize} font-semibold mt-1 transition-all`}
        style={hit
          ? { color: '#FFD700', textShadow: '0 0 16px rgba(255,215,0,0.55)' }
          : { color: '#FFFFFF', textShadow: `0 0 24px ${accent}44` }
        }
      >
        {achieved.toLocaleString()}{suffix}
      </p>

      {target !== null && (
        <p className="text-[10px] text-mh-muted mt-0.5">
          Target: {target.toLocaleString()}{suffix}
        </p>
      )}

      {pct !== null && (
        <div className="mt-2 h-1 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.07)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: barColor }}
          />
        </div>
      )}
    </div>
  )
}
