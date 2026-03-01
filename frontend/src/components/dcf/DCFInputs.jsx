function InputRow({ label, value, onChange, min, max, step, pct, helper }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="flex-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {helper && <p className="text-xs text-gray-400 mt-0.5">{helper}</p>}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={pct ? (value * 100).toFixed(2) : value}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            onChange(isNaN(v) ? 0 : pct ? v / 100 : v)
          }}
          min={min}
          max={max}
          step={step || (pct ? 0.1 : 0.01)}
          className="w-24 text-right input-field text-sm py-1.5"
        />
        {pct && <span className="text-gray-500 text-sm">%</span>}
      </div>
    </div>
  )
}

export default function DCFInputs({ assumptions, onChange }) {
  const set = (key) => (val) => onChange({ ...assumptions, [key]: val })

  return (
    <div className="space-y-1">
      <h3 className="text-base font-semibold text-gray-800 mb-3">Model Assumptions</h3>

      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Revenue Growth
        </p>
        {[0, 1, 2].map((i) => (
          <InputRow
            key={i}
            label={`Year ${i + 1} Growth`}
            value={assumptions.revenue_growth_rates?.[i] ?? 0.08}
            onChange={(v) => {
              const rates = [...(assumptions.revenue_growth_rates || [0.08, 0.07, 0.06])]
              rates[i] = v
              set('revenue_growth_rates')(rates)
            }}
            pct
            step={0.5}
            min={-50}
            max={100}
          />
        ))}
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Margins & Costs
        </p>
        <InputRow label="EBITDA Margin" value={assumptions.ebitda_margin ?? 0.20} onChange={set('ebitda_margin')} pct min={0} max={100} helper="Trailing / projected" />
        <InputRow label="CapEx % Revenue" value={assumptions.capex_pct_revenue ?? 0.05} onChange={set('capex_pct_revenue')} pct min={0} max={50} />
        <InputRow label="D&A % Revenue" value={assumptions.da_pct_revenue ?? 0.04} onChange={set('da_pct_revenue')} pct min={0} max={30} />
        <InputRow label="Tax Rate" value={assumptions.tax_rate ?? 0.21} onChange={set('tax_rate')} pct min={0} max={50} />
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          WACC & Terminal Value
        </p>
        <InputRow label="Risk-Free Rate" value={assumptions.risk_free_rate ?? 0.043} onChange={set('risk_free_rate')} pct step={0.05} min={0} max={10} helper="10Y Treasury yield" />
        <InputRow label="Equity Risk Premium" value={assumptions.equity_risk_premium ?? 0.055} onChange={set('equity_risk_premium')} pct step={0.1} min={0} max={15} />
        <InputRow label="Terminal Growth Rate" value={assumptions.terminal_growth_rate ?? 0.025} onChange={set('terminal_growth_rate')} pct step={0.1} min={0} max={5} helper="Long-term FCF growth" />
        <InputRow label="Exit EV/EBITDA Multiple" value={assumptions.exit_multiple ?? 12} onChange={set('exit_multiple')} step={0.5} min={2} max={50} helper="Terminal multiple" />
      </div>
    </div>
  )
}
