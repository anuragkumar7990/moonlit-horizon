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
  background: 'rgba(10,10,18,0.92)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  color: '#FFFFFF',
  fontSize: '12px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
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
            className="text-[11px] px-3 py-1 rounded-full font-medium transition-all"
            style={filter === f.key
              ? {
                  background: 'linear-gradient(135deg, #E8341C, #FF5A3A)',
                  border: '1px solid rgba(232,52,28,0.6)',
                  color: '#fff',
                  boxShadow: '0 0 12px rgba(232,52,28,0.3)',
                }
              : {
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  color: '#888899',
                }
            }
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
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="week"
                tick={{ fill: '#888899', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#888899', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
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
