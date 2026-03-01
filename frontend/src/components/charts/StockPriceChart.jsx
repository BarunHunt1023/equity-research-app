import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts'

function fmtDate(iso) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  } catch {
    return iso
  }
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="text-gray-500 mb-1">{label}</p>
      <p className="font-semibold text-gray-800">${payload[0]?.value?.toFixed(2)}</p>
    </div>
  )
}

export default function StockPriceChart({ historicalPrices, impliedPrice }) {
  if (!historicalPrices?.length) {
    return <p className="text-gray-400 text-sm">No price history available</p>
  }

  // Downsample to at most 120 points for performance
  const step = Math.max(1, Math.floor(historicalPrices.length / 120))
  const data = historicalPrices
    .filter((_, i) => i % step === 0)
    .map((p) => ({ date: fmtDate(p.date), close: p.close }))

  const prices = data.map((d) => d.close).filter(Boolean)
  const minY = Math.min(...prices) * 0.9
  const maxY = Math.max(Math.max(...prices) * 1.1, (impliedPrice || 0) * 1.1)

  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
        <defs>
          <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          interval={Math.floor(data.length / 8)}
          tickLine={false}
        />
        <YAxis
          domain={[minY, maxY]}
          tickFormatter={(v) => `$${v.toFixed(0)}`}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        {impliedPrice > 0 && (
          <ReferenceLine
            y={impliedPrice}
            stroke="#10b981"
            strokeDasharray="5 5"
            strokeWidth={2}
            label={{
              value: `Intrinsic $${impliedPrice.toFixed(0)}`,
              position: 'right',
              fontSize: 11,
              fill: '#10b981',
            }}
          />
        )}
        <Area
          type="monotone"
          dataKey="close"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#priceGradient)"
          dot={false}
          name="Price"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
