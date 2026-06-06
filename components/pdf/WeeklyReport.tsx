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
  text:        { fontSize: 8.5, color: '#333', lineHeight: 1.6, marginBottom: 3 },
  bullet:      { fontSize: 8.5, color: '#333', lineHeight: 1.6, marginBottom: 2, paddingLeft: 10 },
  dealRow:     { flexDirection: 'row', paddingVertical: 4, borderBottom: '1 solid #f0f0f0' },
  dealName:    { flex: 2, fontSize: 8.5, color: '#222' },
  dealStage:   { flex: 1, fontSize: 8, color: '#888' },
  dealAmt:     { flex: 1, fontSize: 8.5, color: '#333', textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  footer:      { position: 'absolute', bottom: 24, left: 44, right: 44, textAlign: 'center', fontSize: 7, color: '#bbb' },
})

export interface WeeklyReportData {
  weekOf: string
  generatedAt: string
  calls: { dialled: number; connected: number; rate: string; meetingsBooked: number }
  meetings: { l1Booked: number; l1Conducted: number; l2Conducted: number }
  leads: { hot: number; warm: number; cold: number; total: number }
  hotDeals: { name: string; stage: string; amount: number }[]
  summary: string
}

function fmtAmt(n: number) {
  if (!n) return '—'
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  return `₹${n.toLocaleString('en-IN')}`
}

export function WeeklyReport({ data }: { data: WeeklyReportData }) {
  return (
    <Document title={`The Test Tribe — Weekly Report ${data.weekOf}`}>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <Text style={S.brand}>The Test Tribe</Text>
          <Text style={S.reportTitle}>Weekly Sales Report — {data.weekOf}</Text>
          <Text style={S.dateLabel}>Generated {data.generatedAt}</Text>
        </View>

        {/* Calling */}
        <View style={S.section}>
          <Text style={S.sectionHdr}>Calling Performance</Text>
          <View style={S.statRow}>
            <View style={[S.statBox]}>
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

        {/* Pipeline */}
        <View style={S.section}>
          <Text style={S.sectionHdr}>Pipeline</Text>
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
            <View style={S.statBox}>
              <Text style={S.statLabel}>Total</Text>
              <Text style={S.statValue}>{data.leads.total}</Text>
            </View>
          </View>

          {data.hotDeals.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 8, color: '#888', marginBottom: 4, textTransform: 'uppercase' }}>Hot Deals</Text>
              {data.hotDeals.slice(0, 6).map((d, i) => (
                <View key={i} style={S.dealRow}>
                  <Text style={S.dealName}>{d.name}</Text>
                  <Text style={S.dealStage}>{d.stage}</Text>
                  <Text style={S.dealAmt}>{fmtAmt(d.amount)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* AI Summary */}
        {data.summary && (
          <View style={S.section}>
            <Text style={S.sectionHdr}>Weekly Summary</Text>
            {data.summary.split('\n').filter(l => l.trim()).map((line, i) => (
              <Text key={i} style={line.startsWith('•') ? S.bullet : S.text}>{line}</Text>
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
