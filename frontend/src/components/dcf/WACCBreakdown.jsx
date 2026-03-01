import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#3b82f6', '#64748b']

function pct(v) { return v != null ? `${(v * 100).toFixed(2)}%` : '—' }

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between py-1.5 border-b border-gray-50 last:border-0 ${bold ? 'font-semibold' : ''}`}>
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm text-gray-800 tabular-nums">{value}</span>
    </div>
  )
}

export default function WACCBreakdown({ wacc }) {
  if (!wacc) return null

  const pieData = [
    { name: `Equity (${pct(wacc.weight_equity)})`, value: wacc.weight_equity ?? 0 },
    { name: `Debt (${pct(wacc.weight_debt)})`, value: wacc.weight_debt ?? 0 },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Pie chart */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Capital Structure</p>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              dataKey="value"
              paddingAngle={3}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={COLORS[i]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => pct(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Detail table */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">WACC Components</p>
        <Row label="Risk-Free Rate" value={pct(wacc.risk_free_rate)} />
        <Row label="Beta" value={wacc.beta?.toFixed(2) ?? '—'} />
        <Row label="Equity Risk Premium" value={pct(wacc.equity_risk_premium)} />
        <Row label="Cost of Equity (Ke)" value={pct(wacc.cost_of_equity)} bold />
        <div className="my-2 border-t border-gray-100" />
        <Row label="Cost of Debt (pre-tax)" value={pct(wacc.cost_of_debt_pretax)} />
        <Row label="Tax Rate" value={pct(wacc.tax_rate)} />
        <Row label="Cost of Debt (after-tax)" value={pct(wacc.cost_of_debt_after_tax)} bold />
        <div className="my-2 border-t border-gray-200" />
        <Row label="Weight of Equity" value={pct(wacc.weight_equity)} />
        <Row label="Weight of Debt" value={pct(wacc.weight_debt)} />
        <div className="mt-3 bg-primary-50 rounded-lg p-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-primary-700">WACC</span>
            <span className="text-lg font-bold text-primary-700">{pct(wacc.wacc)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
