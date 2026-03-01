import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, LabelList
} from 'recharts'

const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      <p>Low: <span className="font-medium">${d?.low?.toFixed(2)}</span></p>
      <p>Mid: <span className="font-medium text-primary-600">${d?.mid?.toFixed(2)}</span></p>
      <p>High: <span className="font-medium">${d?.high?.toFixed(2)}</span></p>
    </div>
  )
}

export default function FootballFieldChart({ footballField, currentPrice }) {
  if (!footballField?.length) {
    return <p className="text-gray-400 text-sm">No valuation range data available</p>
  }

  // Transform for Recharts: show range as stacked bars
  // bar 1 = invisible base (low), bar 2 = range (high - low), dot at mid
  const data = footballField.map((d) => ({
    method: d.method,
    low: d.low,
    range: d.high - d.low,
    mid: d.mid,
    high: d.high,
    base: d.low, // used as transparent offset
  }))

  const allPrices = footballField.flatMap((d) => [d.low, d.high])
  const minY = Math.max(0, Math.min(...allPrices) * 0.85)
  const maxY = Math.max(...allPrices) * 1.15

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 10, right: 60, left: 100, bottom: 10 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          type="number"
          domain={[minY, maxY]}
          tickFormatter={(v) => `$${v.toFixed(0)}`}
          tick={{ fontSize: 11, fill: '#6b7280' }}
        />
        <YAxis
          type="category"
          dataKey="method"
          tick={{ fontSize: 12, fill: '#374151' }}
          width={90}
        />
        <Tooltip content={<CustomTooltip />} />
        {currentPrice > 0 && (
          <ReferenceLine
            x={currentPrice}
            stroke="#ef4444"
            strokeDasharray="4 4"
            strokeWidth={2}
            label={{ value: `$${currentPrice.toFixed(0)}`, position: 'top', fontSize: 11, fill: '#ef4444' }}
          />
        )}
        {/* Invisible base bar */}
        <Bar dataKey="base" stackId="a" fill="transparent" />
        {/* Colored range bar */}
        <Bar dataKey="range" stackId="a" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.75} />
          ))}
          <LabelList
            dataKey="mid"
            position="right"
            formatter={(v) => `$${v?.toFixed(0)}`}
            style={{ fontSize: 11, fill: '#374151', fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
