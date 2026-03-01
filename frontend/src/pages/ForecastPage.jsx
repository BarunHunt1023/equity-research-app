import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysis, useAnalysisDispatch } from '../context/AnalysisContext'
import { getForecast } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import FCFWaterfallChart from '../components/charts/FCFWaterfallChart'
import RevenueEarningsChart from '../components/charts/RevenueEarningsChart'

function fmt(n) {
  if (n == null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${n.toFixed(1)}`
}
function pct(v) { return v != null ? `${(v * 100).toFixed(1)}%` : '—' }

function NumInput({ label, value, onChange, pct: isPct, min, max, step, helper }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-sm text-gray-700">{label}</p>
        {helper && <p className="text-xs text-gray-400">{helper}</p>}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={isPct ? (value * 100).toFixed(1) : value}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            onChange(isNaN(v) ? 0 : isPct ? v / 100 : v)
          }}
          step={step || (isPct ? 0.5 : 0.1)}
          min={min}
          max={max}
          className="w-20 text-right input-field text-sm py-1"
        />
        {isPct && <span className="text-gray-400 text-sm">%</span>}
      </div>
    </div>
  )
}

export default function ForecastPage() {
  const { ticker, companyInfo, forecast: ctxForecast, ratios } = useAnalysis()
  const dispatch = useAnalysisDispatch()
  const navigate = useNavigate()

  const raw = ratios?.raw_values || {}
  const [assumptions, setAssumptions] = useState({
    revenue_growth_rates: [0.08, 0.07, 0.06],
    ebitda_margin: raw.ebitda && raw.revenue ? raw.ebitda / raw.revenue : 0.20,
    capex_pct_revenue: 0.05,
    da_pct_revenue: 0.04,
    nwc_pct_revenue: 0.10,
    tax_rate: 0.21,
  })
  const [forecast, setForecast] = useState(ctxForecast)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (ctxForecast) setForecast(ctxForecast)
  }, [ctxForecast])

  const runForecast = async () => {
    if (!ticker) return
    setLoading(true)
    setError('')
    try {
      const data = await getForecast(ticker, assumptions)
      setForecast(data)
      dispatch({ type: 'SET_FORECAST', payload: data })
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to generate forecast')
    } finally {
      setLoading(false)
    }
  }

  // Combine historical + forecast for revenue chart
  const projectedAsHistorical = forecast?.projections?.map((p, i) => ({
    period: `Year +${p.year}`,
    revenue: p.revenue,
    net_income: p.net_income,
    gross_margin: null,
    ebitda_margin: p.ebitda_margin,
    net_margin: p.net_margin,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">3-Year Financial Forecast</h1>
        <p className="text-gray-500 text-sm mt-1">
          Adjust assumptions and regenerate to see updated projections
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assumptions panel */}
        <div className="card lg:col-span-1">
          <h2 className="section-title">Assumptions</h2>

          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Revenue Growth</p>
            {[0, 1, 2].map((i) => (
              <NumInput
                key={i}
                label={`Year ${i + 1}`}
                value={assumptions.revenue_growth_rates[i] ?? 0.08}
                onChange={(v) => {
                  const rates = [...assumptions.revenue_growth_rates]
                  rates[i] = v
                  setAssumptions({ ...assumptions, revenue_growth_rates: rates })
                }}
                pct
                min={-50}
                max={100}
              />
            ))}
          </div>

          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Margins</p>
            <NumInput label="EBITDA Margin" value={assumptions.ebitda_margin} onChange={(v) => setAssumptions({ ...assumptions, ebitda_margin: v })} pct min={0} max={100} />
            <NumInput label="CapEx % Revenue" value={assumptions.capex_pct_revenue} onChange={(v) => setAssumptions({ ...assumptions, capex_pct_revenue: v })} pct min={0} max={50} />
            <NumInput label="D&A % Revenue" value={assumptions.da_pct_revenue} onChange={(v) => setAssumptions({ ...assumptions, da_pct_revenue: v })} pct min={0} max={30} />
            <NumInput label="NWC % Revenue" value={assumptions.nwc_pct_revenue} onChange={(v) => setAssumptions({ ...assumptions, nwc_pct_revenue: v })} pct min={0} max={50} />
            <NumInput label="Tax Rate" value={assumptions.tax_rate} onChange={(v) => setAssumptions({ ...assumptions, tax_rate: v })} pct min={0} max={50} />
          </div>

          <button
            onClick={runForecast}
            disabled={loading || !ticker}
            className="btn-primary w-full mt-2"
          >
            {loading ? 'Generating...' : 'Run Forecast'}
          </button>
          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
          {!ticker && (
            <p className="text-amber-600 text-xs mt-2">Please analyze a company first on the Home page</p>
          )}
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          {loading && <LoadingSpinner message="Building forecast model..." />}

          {forecast && !loading && (
            <>
              {/* Projection table */}
              <div className="card">
                <h2 className="section-title">Projected Financials</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-2 pr-4 text-xs text-gray-500 font-semibold uppercase tracking-wide w-40">Metric</th>
                        {forecast.projections?.map((p) => (
                          <th key={p.year} className="text-right py-2 px-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">
                            Year {p.year}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Revenue', key: 'revenue', fmtr: fmt },
                        { label: 'Revenue Growth', key: 'revenue_growth', fmtr: pct },
                        { label: 'EBITDA', key: 'ebitda', fmtr: fmt },
                        { label: 'EBITDA Margin', key: 'ebitda_margin', fmtr: pct },
                        { label: 'D&A', key: 'depreciation_amortization', fmtr: fmt },
                        { label: 'EBIT', key: 'ebit', fmtr: fmt },
                        { label: 'NOPAT', key: 'nopat', fmtr: fmt },
                        { label: 'Net Income', key: 'net_income', fmtr: fmt },
                        { label: 'Net Margin', key: 'net_margin', fmtr: pct },
                        { label: 'CapEx', key: 'capex', fmtr: (v) => `(${fmt(v)})` },
                        { label: 'ΔNWC', key: 'delta_nwc', fmtr: (v) => `(${fmt(v)})` },
                        { label: 'Free Cash Flow', key: 'fcf', fmtr: fmt, bold: true },
                      ].map(({ label, key, fmtr, bold }) => (
                        <tr key={key} className={`border-b border-gray-50 ${bold ? 'bg-primary-50' : 'hover:bg-gray-50'}`}>
                          <td className={`py-2 pr-4 text-xs ${bold ? 'font-bold text-primary-700' : 'text-gray-600'}`}>{label}</td>
                          {forecast.projections?.map((p) => (
                            <td key={p.year} className={`text-right py-2 px-3 text-xs tabular-nums ${bold ? 'font-bold text-primary-700' : 'text-gray-700'}`}>
                              {fmtr(p[key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* FCF waterfall */}
              <div className="card">
                <h2 className="section-title">FCF Bridge (Year 1)</h2>
                <FCFWaterfallChart forecast={forecast} />
              </div>

              {/* Revenue trend */}
              <div className="card">
                <h2 className="section-title">Projected Revenue & Net Income</h2>
                <RevenueEarningsChart historicalMetrics={projectedAsHistorical} />
              </div>
            </>
          )}

          {!forecast && !loading && (
            <div className="card text-center py-12">
              <p className="text-gray-400">Click "Run Forecast" to generate 3-year projections</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={() => navigate('/financials')} className="btn-secondary">← Financials</button>
        <button onClick={() => navigate('/valuation')} className="btn-primary">Next: Valuation →</button>
      </div>
    </div>
  )
}
