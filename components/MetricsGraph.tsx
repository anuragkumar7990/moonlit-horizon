'use client'
import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import type { WeeklyPoint } from '@/lib/types'

type Filter = 'calls' | 'meetings' | 'conversion' | 'emails'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'calls',      label: 'Calls'           },
  { key: 'meetings',   label: 'Meetings'        },
  { key: 'conversion', label: 'Lead Conversion' },
  { key: 'emails',     label: 'Emails'          },
]

const LEGEND_ITEMS: Record<Filter, { name: string; color: string }[]> = {
  calls:      [{ name: 'Dialled', color: '#E8341C' }, { name: 'Connected', color: '#22C55E' }],
  meetings:   [{ name: 'L1 Booked', color: '#E8341C' }, { name: 'L1 Conducted', color: '#FFD700' }],
  conversion: [{ name: 'Connection %', color: '#E8341C' }, { name: 'Booking %', color: '#22C55E' }],
  emails:     [],
}

const TOOLTIP_STYLE = {
  background: '#111111',
  border: '1px solid #2A2A2A',
  borderRadius: '8px',
  color: '#FFFFFF',
  fontSize: '12px',
}

export default function MetricsGraph({ data }: { data: WeeklyPoint[] }) {
  const [filter, setFilter] = useState<Filter>('calls')

  return (
    <div className="flex flex-col h-full">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-[11px] px-3 py-1 rounded-full border font-medium transition-colors
              ${filter === f.key
                ? 'bg-mh-vermillion border-mh-vermillion text-white'
                : 'border-mh-border text-mh-muted hover:border-mh-muted hover:text-mh-text'
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Custom legend — fully controlled order */}
      {filter !== 'emails' && (
        <div className="flex gap-4 mb-2">
          {LEGEND_ITEMS[filter].map(item => (
            <span key={item.name} className="flex items-center gap-1.5 text-[11px] text-mh-muted">
              <span className="inline-block w-5 h-[2px] rounded" style={{ background: item.color }} />
              {item.name}
            </span>
          ))}
        </div>
      )}

      {/* Chart area */}
      <div className="flex-1 min-h-0">
        {filter === 'emails' ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-mh-muted text-sm">Email tracking coming in Phase 2</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
              <XAxis
                dataKey="week"
                tick={{ fill: '#999999', fontSize: 10 }}
                axisLine={{ stroke: '#2A2A2A' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#999999', fontSize: 10 }}
                axisLine={{ stroke: '#2A2A2A' }}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />

              {filter === 'calls' && <>
                <Line type="monotone" dataKey="dialled"   stroke="#E8341C" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="connected" stroke="#22C55E" strokeWidth={2} dot={false} />
              </>}

              {filter === 'meetings' && <>
                <Line type="monotone" dataKey="l1Booked"    stroke="#E8341C" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="l1Conducted" stroke="#FFD700" strokeWidth={2} dot={false} />
              </>}

              {filter === 'conversion' && <>
                <Line type="monotone" dataKey="connectionRate" stroke="#E8341C" strokeWidth={2} dot={false} unit="%" />
                <Line type="monotone" dataKey="bookingRate"    stroke="#22C55E" strokeWidth={2} dot={false} unit="%" />
              </>}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
