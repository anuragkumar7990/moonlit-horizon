import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const S = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', padding: 44, backgroundColor: '#ffffff', color: '#1a1a1a', fontSize: 9 },
  header:      { marginBottom: 24, borderBottom: '2 solid #CC3300', paddingBottom: 10 },
  brand:       { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#CC3300' },
  reportTitle: { fontSize: 11, color: '#444', marginTop: 3 },
  dateLabel:   { fontSize: 8, color: '#888', marginTop: 2 },
  section:     { marginBottom: 18 },
  sectionHdr:  { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#333', marginBottom: 8, paddingBottom: 4, borderBottom: '1 solid #e8e8e8' },
  statRow:     { flexDirection: 'row', gap: 8, marginBottom: 4 },
  statBox:     { flex: 1, padding: 10, backgroundColor: '#f8f8f8', borderRadius: 4, borderLeft: '3 solid #CC3300' },
  statLabel:   { fontSize: 7, color: '#888', marginBottom: 3, textTransform: 'uppercase' },
  statValue:   { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1a1a1a' },
  statSub:     { fontSize: 7, color: '#aaa', marginTop: 2 },
  greenBox:    { borderLeft: '3 solid #22c55e' },
  goldBox:     { borderLeft: '3 solid #D4AF37' },
  targetRow:   { flexDirection: 'row', paddingVertical: 5, borderBottom: '1 solid #f0f0f0', alignItems: 'center' },
  targetMetric:{ flex: 2, fontSize: 8.5, color: '#222' },
  targetActual:{ flex: 1, fontSize: 8.5, color: '#333', fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  targetGoal:  { flex: 1, fontSize: 8, color: '#888', textAlign: 'center' },
  targetPct:   { flex: 1, fontSize: 8.5, textAlign: 'right' },
  footer:      { position: 'absolute', bottom: 24, left: 44, right: 44, textAlign: 'center', fontSize: 7, color: '#bbb' },
})

export interface MonthlyReportData {
  month: string
  generatedAt: string
  calls: { dialled: number; connected: number; rate: string; meetingsBooked: number }
  meetings: { l1Booked: number; l1Conducted: number; l2Conducted: number }
  leads: { hot: number; warm: number; cold: number; total: number }
  targets: { metric: string; actual: number; target: number | null }[]
  wonDeals: { name: string; amount: number }[]
  pipelineAmount: number
}

function fmtAmt(n: number) {
  if (!n) return '—'
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  return `₹${n.toLocaleString('en-IN')}`
}

function pctColor(actual: number, target: number | null): string {
  if (!target) return '#888'
  const pct = (actual / target) * 100
  if (pct >= 100) return '#22c55e'
  if (pct >= 70)  return '#D4AF37'
  return '#CC3300'
}

export function MonthlyReport({ data }: { data: MonthlyReportData }) {
  return (
    <Document title={`The Test Tribe — Monthly Report ${data.month}`}>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <Text style={S.brand}>The Test Tribe</Text>
          <Text style={S.reportTitle}>Monthly Sales Report — {data.month}</Text>
          <Text style={S.dateLabel}>Generated {data.generatedAt}</Text>
        </View>

        {/* Calling */}
        <View style={S.section}>
          <Text style={S.sectionHdr}>Calling Performance</Text>
          <View style={S.statRow}>
            <View style={S.statBox}>
              <Text style={S.statLabel}>Calls Dialled</Text>
              <Text style={S.statValue}>{data.calls.dialled}</Text>
            </View>
            <View style={[S.statBox, S.greenBox]}>
              <Text style={S.statLabel}>Connected</Text>
              <Text style={S.statValue}>{data.calls.connected}</Text>
              <Text style={S.statSub}>{data.calls.rate}% rate</Text>
            </View>
            <View style={[S.statBox, S.goldBox]}>
              <Text style={S.statLabel}>Meetings Booked</Text>
              <Text style={S.statValue}>{data.calls.meetingsBooked}</Text>
            </View>
          </View>
        </View>

        {/* Meetings */}
        <View style={S.section}>
          <Text style={S.sectionHdr}>Meetings</Text>
          <View style={S.statRow}>
            <View style={S.statBox}>
              <Text style={S.statLabel}>L1 Booked</Text>
              <Text style={S.statValue}>{data.meetings.l1Booked}</Text>
            </View>
            <View style={[S.statBox, S.greenBox]}>
              <Text style={S.statLabel}>L1 Conducted</Text>
              <Text style={S.statValue}>{data.meetings.l1Conducted}</Text>
            </View>
            <View style={[S.statBox, S.goldBox]}>
              <Text style={S.statLabel}>L2 Conducted</Text>
              <Text style={S.statValue}>{data.meetings.l2Conducted}</Text>
            </View>
          </View>
        </View>

        {/* Targets vs Actuals */}
        {data.targets.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionHdr}>Targets vs Actuals</Text>
            <View style={[S.targetRow, { borderBottom: '1.5 solid #e0e0e0' }]}>
              <Text style={[S.targetMetric, { color: '#888', fontSize: 7, textTransform: 'uppercase' }]}>Metric</Text>
              <Text style={[S.targetActual, { color: '#888', fontSize: 7, textTransform: 'uppercase' }]}>Actual</Text>
              <Text style={[S.targetGoal,   { color: '#888', fontSize: 7, textTransform: 'uppercase' }]}>Target</Text>
              <Text style={[S.targetPct,    { color: '#888', fontSize: 7, textTransform: 'uppercase' }]}>Attainment</Text>
            </View>
            {data.targets.map((t, i) => {
              const pct = t.target ? Math.round((t.actual / t.target) * 100) : null
              return (
                <View key={i} style={S.targetRow}>
                  <Text style={S.targetMetric}>{t.metric}</Text>
                  <Text style={S.targetActual}>{t.actual}</Text>
                  <Text style={S.targetGoal}>{t.target ?? '—'}</Text>
                  <Text style={[S.targetPct, { color: pctColor(t.actual, t.target) }]}>
                    {pct != null ? `${pct}%` : '—'}
                  </Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Pipeline */}
        <View style={S.section}>
          <Text style={S.sectionHdr}>Pipeline End-of-Month</Text>
          <View style={S.statRow}>
            <View style={[S.statBox, { borderLeft: '3 solid #ef4444' }]}>
              <Text style={S.statLabel}>Hot</Text>
              <Text style={S.statValue}>{data.leads.hot}</Text>
            </View>
            <View style={[S.statBox, S.goldBox]}>
              <Text style={S.statLabel}>Warm</Text>
              <Text style={S.statValue}>{data.leads.warm}</Text>
            </View>
            <View style={S.statBox}>
              <Text style={S.statLabel}>Cold</Text>
              <Text style={S.statValue}>{data.leads.cold}</Text>
            </View>
            <View style={[S.statBox, S.greenBox]}>
              <Text style={S.statLabel}>Pipeline Value</Text>
              <Text style={[S.statValue, { fontSize: 13 }]}>{fmtAmt(data.pipelineAmount)}</Text>
            </View>
          </View>
        </View>

        {/* Won Deals */}
        {data.wonDeals.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionHdr}>Won This Month</Text>
            {data.wonDeals.map((d, i) => (
              <View key={i} style={[S.targetRow]}>
                <Text style={S.targetMetric}>{d.name}</Text>
                <Text style={[S.targetActual, { color: '#22c55e', fontFamily: 'Helvetica-Bold' }]}>
                  {fmtAmt(d.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={S.footer}>
          The Test Tribe · Confidential · Generated by Moonlit Horizon
        </Text>
      </Page>
    </Document>
  )
}
