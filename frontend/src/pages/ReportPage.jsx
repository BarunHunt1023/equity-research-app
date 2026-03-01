import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysis, useAnalysisDispatch } from '../context/AnalysisContext'
import { generateReport } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import RevenueEarningsChart from '../components/charts/RevenueEarningsChart'
import MarginChart from '../components/charts/MarginChart'
import StockPriceChart from '../components/charts/StockPriceChart'
import SensitivityHeatmap from '../components/charts/SensitivityHeatmap'
import FootballFieldChart from '../components/charts/FootballFieldChart'
import FCFWaterfallChart from '../components/charts/FCFWaterfallChart'

function fmt(n) {
  if (n == null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${n.toFixed(2)}`
}
function pct(v) { return v != null ? `${(v * 100).toFixed(1)}%` : '—' }

const REC_STYLES = {
  BUY: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  HOLD: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  SELL: 'bg-red-100 text-red-800 border-red-200',
}

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">{title}</h2>
      {children}
    </div>
  )
}

function NarrativeBlock({ text }) {
  if (!text) return <p className="text-gray-400 italic text-sm">Not available</p>
  if (typeof text === 'object') {
    return (
      <div className="space-y-2">
        {Object.entries(text).map(([k, v]) => (
          <div key={k}>
            <p className="text-sm font-semibold text-gray-700 capitalize mb-1">
              {k.replace(/_/g, ' ')}
            </p>
            <p className="text-gray-600 text-sm leading-relaxed">{typeof v === 'string' ? v : JSON.stringify(v)}</p>
          </div>
        ))}
      </div>
    )
  }
  return <p className="text-gray-600 text-sm leading-relaxed">{text}</p>
}

export default function ReportPage() {
  const { ticker, companyInfo, dcf, relativeValuation, forecast, historicalMetrics, historicalPrices, ratios } = useAnalysis()
  const dispatch = useAnalysisDispatch()
  const navigate = useNavigate()

  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (!ticker) return
    setLoading(true)
    setError('')
    try {
      // Pass DCF and rel val params if available
      const params = {}
      if (dcf?.wacc) {
        params.risk_free_rate = dcf.wacc.risk_free_rate
        params.equity_risk_premium = dcf.wacc.equity_risk_premium
        params.terminal_growth_rate = dcf.terminal_value?.terminal_growth_rate
      }
      const data = await generateReport(ticker, params)
      setReport(data)
      dispatch({ type: 'SET_REPORT', payload: data })
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => window.print()

  if (!ticker) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">No company analyzed yet.</p>
        <button onClick={() => navigate('/')} className="btn-primary">Go to Home</button>
      </div>
    )
  }

  const narrative = report?.narrative
  const reportCompany = report?.company || companyInfo
  const reportDCF = report?.dcf || dcf
  const reportRelVal = report?.relative_valuation || relativeValuation
  const reportForecast = report?.forecast || forecast

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equity Research Report</h1>
          {reportCompany && (
            <p className="text-gray-500 text-sm mt-0.5">{reportCompany.name} ({reportCompany.ticker})</p>
          )}
        </div>
        <div className="flex gap-3">
          {report && (
            <button onClick={handlePrint} className="btn-secondary text-sm">
              Print / Export PDF
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Generating...' : report ? 'Regenerate Report' : 'Generate Report'}
          </button>
        </div>
      </div>

      {loading && <LoadingSpinner message="Generating AI-enhanced equity research report..." />}
      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {!report && !loading && (
        <div className="card text-center py-16">
          <div className="text-4xl mb-4">📋</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Ready to Generate Report</h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Click "Generate Report" to create a comprehensive equity research report with
            AI-powered narrative analysis, valuation summaries, and embedded charts.
          </p>
        </div>
      )}

      {report && !loading && (
        <div id="report-content" className="space-y-6 print:space-y-4">
          {/* Cover */}
          <div className="card print:shadow-none print:border">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                  Equity Research Report
                </p>
                <h1 className="text-3xl font-bold text-gray-900 mb-1">{reportCompany?.name}</h1>
                <p className="text-gray-500 text-sm mb-4">
                  {reportCompany?.ticker} · {reportCompany?.sector} · {reportCompany?.industry}
                </p>
                <div className="flex items-center gap-4 flex-wrap">
                  {report.recommendation && (
                    <span className={`text-sm font-bold px-4 py-1.5 rounded-lg border ${REC_STYLES[report.recommendation] || REC_STYLES.HOLD}`}>
                      {report.recommendation}
                    </span>
                  )}
                  {report.target_price && (
                    <div>
                      <p className="text-xs text-gray-400">Target Price</p>
                      <p className="text-2xl font-bold text-gray-900">${report.target_price.toFixed(2)}</p>
                    </div>
                  )}
                  {report.current_price && (
                    <div>
                      <p className="text-xs text-gray-400">Current Price</p>
                      <p className="text-xl font-semibold text-gray-700">${report.current_price.toFixed(2)}</p>
                    </div>
                  )}
                  {report.upside_pct != null && (
                    <div>
                      <p className="text-xs text-gray-400">Upside / Downside</p>
                      <p className={`text-xl font-bold ${report.upside_pct > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {report.upside_pct > 0 ? '+' : ''}{(report.upside_pct * 100).toFixed(1)}%
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right text-sm text-gray-400">
                <p>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p className="mt-1">Equity Research Pro</p>
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          {narrative?.executive_summary && (
            <div className="card">
              <Section title="Executive Summary">
                <NarrativeBlock text={narrative.executive_summary} />
              </Section>
            </div>
          )}

          {/* Investment Thesis */}
          {narrative?.investment_thesis && (
            <div className="card">
              <Section title="Investment Thesis">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { key: 'bull_case', label: 'Bull Case', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                    { key: 'base_case', label: 'Base Case', color: 'bg-blue-50 border-blue-200 text-blue-700' },
                    { key: 'bear_case', label: 'Bear Case', color: 'bg-red-50 border-red-200 text-red-700' },
                  ].map(({ key, label, color }) => (
                    <div key={key} className={`rounded-lg p-4 border ${color}`}>
                      <p className="font-semibold text-sm mb-2">{label}</p>
                      <p className="text-sm leading-relaxed">{narrative.investment_thesis[key]}</p>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* Business Overview */}
          {narrative?.business_overview && (
            <div className="card">
              <Section title="Business Overview">
                <NarrativeBlock text={narrative.business_overview} />
              </Section>
            </div>
          )}

          {/* Historical performance charts */}
          {historicalMetrics?.length > 0 && (
            <div className="card">
              <Section title="Historical Financial Performance">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-3">Revenue & Net Income</p>
                    <RevenueEarningsChart historicalMetrics={historicalMetrics} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-3">Margin Trends</p>
                    <MarginChart historicalMetrics={historicalMetrics} />
                  </div>
                </div>
              </Section>
            </div>
          )}

          {/* Financial Highlights */}
          {narrative?.financial_highlights && (
            <div className="card">
              <Section title="Financial Highlights">
                <NarrativeBlock text={narrative.financial_highlights} />
                {/* Key metrics table */}
                {ratios && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    {[
                      ['Revenue', fmt(ratios.raw_values?.revenue)],
                      ['EBITDA Margin', pct(ratios.profitability?.ebitda_margin)],
                      ['Net Margin', pct(ratios.profitability?.net_margin)],
                      ['ROE', pct(ratios.profitability?.roe)],
                      ['D/E Ratio', ratios.solvency?.debt_to_equity?.toFixed(2)],
                      ['Current Ratio', ratios.liquidity?.current_ratio?.toFixed(2)],
                      ['P/E (Trailing)', reportCompany?.trailing_pe?.toFixed(1)],
                      ['Beta', reportCompany?.beta?.toFixed(2)],
                    ].map(([label, value]) => (
                      <div key={label} className="metric-card">
                        <p className="text-xs text-gray-400">{label}</p>
                        <p className="font-bold text-gray-900 text-sm mt-0.5">{value ?? '—'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          )}

          {/* DCF Section */}
          {reportDCF && !reportDCF.error && (
            <div className="card">
              <Section title="Discounted Cash Flow (DCF) Valuation">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {[
                    ['WACC', pct(reportDCF.wacc?.wacc)],
                    ['Enterprise Value', fmt(reportDCF.enterprise_value)],
                    ['Equity Value', fmt(reportDCF.equity_value)],
                    ['Implied Price', `$${reportDCF.implied_share_price?.toFixed(2)}`],
                  ].map(([label, value]) => (
                    <div key={label} className="metric-card text-center">
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className="font-bold text-gray-900 mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
                {reportForecast && (
                  <>
                    <p className="text-sm font-medium text-gray-600 mb-3">FCF Bridge (Year 1 Projection)</p>
                    <FCFWaterfallChart forecast={reportForecast} />
                  </>
                )}
                {reportDCF.sensitivity && (
                  <div className="mt-6">
                    <p className="text-sm font-medium text-gray-600 mb-3">Sensitivity Analysis (WACC vs Terminal Growth)</p>
                    <SensitivityHeatmap
                      sensitivity={reportDCF.sensitivity}
                      currentPrice={reportCompany?.current_price}
                    />
                  </div>
                )}
              </Section>
            </div>
          )}

          {/* Relative Valuation */}
          {reportRelVal && !reportRelVal.error && reportRelVal.football_field?.length > 0 && (
            <div className="card">
              <Section title="Relative Valuation">
                <p className="text-sm font-medium text-gray-600 mb-3">Football Field — Valuation Range</p>
                <FootballFieldChart
                  footballField={reportRelVal.football_field}
                  currentPrice={reportRelVal.current_price}
                />
                {Object.keys(reportRelVal.implied_valuations || {}).length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    {Object.values(reportRelVal.implied_valuations).map((v) => (
                      <div key={v.label} className="metric-card text-center">
                        <p className="text-xs text-gray-400">{v.label} Implied</p>
                        <p className="font-bold text-gray-900 mt-0.5">${v.implied_price?.toFixed(2)}</p>
                        <p className="text-xs text-gray-400">{v.multiple_used}x</p>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          )}

          {/* Price chart */}
          {historicalPrices?.length > 0 && (
            <div className="card">
              <Section title="Stock Price vs Intrinsic Value">
                <StockPriceChart
                  historicalPrices={historicalPrices}
                  impliedPrice={report.target_price}
                />
              </Section>
            </div>
          )}

          {/* Risk Factors */}
          {narrative?.risk_factors && (
            <div className="card">
              <Section title="Risk Factors">
                <NarrativeBlock text={narrative.risk_factors} />
              </Section>
            </div>
          )}

          {/* Catalysts */}
          {narrative?.catalysts && (
            <div className="card">
              <Section title="Catalysts">
                <NarrativeBlock text={narrative.catalysts} />
              </Section>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 py-4 border-t border-gray-100">
            Generated by Equity Research Pro · For informational purposes only · Not financial advice
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-start print:hidden">
        <button onClick={() => navigate('/valuation')} className="btn-secondary">← Valuation</button>
      </div>
    </div>
  )
}
