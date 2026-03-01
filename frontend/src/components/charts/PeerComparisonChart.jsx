import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts'

const MULTIPLE_LABELS = {
  pe: 'P/E',
  pb: 'P/B',
  ps: 'P/S',
  ev_ebitda: 'EV/EBITDA',
  ev_revenue: 'EV/Revenue',
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-medium">{p.value != null ? p.value.toFixed(1) + 'x' : '—'}</span>
        </p>
      ))}
    </div>
  )
}

export default function PeerComparisonChart({ targetMultiples, peerSummary }) {
  if (!targetMultiples || !peerSummary) {
    return <p className="text-gray-400 text-sm">No peer comparison data available</p>
  }

  const data = Object.keys(MULTIPLE_LABELS).map((key) => ({
    multiple: MULTIPLE_LABELS[key],
    'Target': targetMultiples[key] ?? null,
    'Peer Median': peerSummary[key]?.median ?? null,
  })).filter((d) => d['Target'] != null || d['Peer Median'] != null)

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="multiple" tick={{ fontSize: 12, fill: '#6b7280' }} />
        <YAxis tickFormatter={(v) => `${v}x`} tick={{ fontSize: 11, fill: '#6b7280' }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Target" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Peer Median" fill="#d1d5db" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
