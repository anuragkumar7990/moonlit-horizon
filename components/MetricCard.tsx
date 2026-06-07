'use client'
import { useState, useEffect, useRef } from 'react'

interface Props {
  label: string
  achieved: number
  target: number | null
  suffix?: string
  size?: 'sm' | 'md' | 'lg'
  accent?: string
  animationDelay?: number
}

function useCountUp(target: number, duration = 900, delay = 0) {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number>(0)
  useEffect(() => {
    let startTs: number | null = null
    const delayTimer = setTimeout(() => {
      const step = (ts: number) => {
        if (!startTs) startTs = ts
        const progress = Math.min((ts - startTs) / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setValue(Math.round(eased * target))
        if (progress < 1) rafRef.current = requestAnimationFrame(step)
      }
      rafRef.current = requestAnimationFrame(step)
    }, delay)
    return () => {
      clearTimeout(delayTimer)
      cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration, delay])
  return value
}

export default function MetricCard({
  label, achieved, target, suffix = '', size = 'md', accent = '#E8341C', animationDelay = 0,
}: Props) {
  const hit = target !== null && achieved >= target && target > 0
  const pct = target !== null && target > 0 ? Math.min((achieved / target) * 100, 100) : null

  const displayValue = useCountUp(achieved, 900, animationDelay)
  const [barWidth, setBarWidth] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setBarWidth(pct ?? 0), animationDelay + 120)
    return () => clearTimeout(t)
  }, [pct, animationDelay])

  const numSize = size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-2xl' : 'text-3xl'
  const glowColor = hit ? '#FFD700' : accent
  const barColor  = hit
    ? 'linear-gradient(90deg, #FFD700, #FFF176)'
    : `linear-gradient(90deg, ${accent}, ${accent}CC)`

  return (
    <div
      className="py-3 pl-3 relative"
      style={{ borderLeft: `2px solid ${glowColor}33` }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: accent }}>
        {label}
      </p>

      <p
        className={`${numSize} font-semibold mt-1 transition-all tabular-nums`}
        style={hit
          ? { color: '#FFD700', textShadow: '0 0 20px rgba(255,215,0,0.6)' }
          : { color: '#FFFFFF', textShadow: `0 0 28px ${accent}55` }
        }
      >
        {displayValue.toLocaleString()}{suffix}
      </p>

      {target !== null && (
        <p className="text-[10px] text-mh-muted mt-0.5">
          Target: {target.toLocaleString()}{suffix}
        </p>
      )}

      {pct !== null && (
        <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${barWidth}%`,
              background: barColor,
              transition: 'width 1s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          />
        </div>
      )}
    </div>
  )
}
