function fmt(n, decimals = 1) {
  if (n == null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(decimals)}T`
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(decimals)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(decimals)}M`
  return `$${n.toFixed(decimals)}`
}

function MetricRow({ label, value, highlight, sub }) {
  return (
    <div className={`flex justify-between items-center py-2.5 border-b border-gray-50 last:border-0 ${highlight ? 'bg-primary-50 -mx-4 px-4 rounded' : ''}`}>
      <div>
        <span className={`text-sm ${highlight ? 'font-semibold text-primary-800' : 'text-gray-600'}`}>{label}</span>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
      <span className={`text-sm tabular-nums ${highlight ? 'font-bold text-primary-700 text-base' : 'text-gray-800 font-medium'}`}>
        {value}
      </span>
    </div>
  )
}

export default function DCFResults({ dcf }) {
  if (!dcf || dcf.error) return null

  const upside = dcf.upside_downside
  const upsideColor = upside > 0 ? 'text-emerald-600' : 'text-red-500'

  return (
    <div className="space-y-4">
      {/* Main result */}
      <div className="bg-gradient-to-br from-primary-50 to-indigo-50 rounded-xl p-5 border border-primary-100">
        <p className="text-xs font-semibold text-primary-500 uppercase tracking-wider mb-1">DCF Implied Price</p>
        <p className="text-4xl font-bold text-primary-700">${dcf.implied_share_price?.toFixed(2)}</p>
        {upside != null && (
          <p className={`text-sm font-medium mt-1 ${upsideColor}`}>
            {upside > 0 ? '+' : ''}{(upside * 100).toFixed(1)}% vs current ${dcf.current_price?.toFixed(2)}
          </p>
        )}
      </div>

      {/* Valuation bridge */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Valuation Bridge</p>
        <MetricRow label="PV of Projected FCFs" value={fmt(dcf.pv_of_fcfs)} />
        <MetricRow
          label="PV of Terminal Value"
          value={fmt(dcf.terminal_value?.pv_terminal)}
          sub={`Gordon: ${fmt(dcf.terminal_value?.gordon_growth)} | Exit: ${fmt(dcf.terminal_value?.exit_multiple)}`}
        />
        <MetricRow label="Enterprise Value" value={fmt(dcf.enterprise_value)} highlight />
        <MetricRow label="Less: Net Debt" value={`(${fmt(dcf.net_debt)})`} />
        <MetricRow label="Equity Value" value={fmt(dcf.equity_value)} />
        <MetricRow label="Shares Outstanding" value={dcf.shares_outstanding ? `${(dcf.shares_outstanding / 1e9).toFixed(2)}B` : '—'} />
        <MetricRow label="Implied Share Price" value={`$${dcf.implied_share_price?.toFixed(2)}`} highlight />
      </div>

      {/* Projected FCFs */}
      {dcf.projected_fcfs?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Projected FCFs</p>
          <div className="grid grid-cols-3 gap-2">
            {dcf.projected_fcfs.map((p) => (
              <div key={p.year} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Year {p.year}</p>
                <p className="font-semibold text-gray-800 text-sm">{fmt(p.fcf)}</p>
                <p className="text-xs text-gray-400">PV: {fmt(p.present_value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
