import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysis, useAnalysisDispatch } from '../context/AnalysisContext'
import { runDCF, runRelativeValuation, getPeers } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import DCFInputs from '../components/dcf/DCFInputs'
import DCFResults from '../components/dcf/DCFResults'
import WACCBreakdown from '../components/dcf/WACCBreakdown'
import SensitivityHeatmap from '../components/charts/SensitivityHeatmap'
import PeerSelector from '../components/relative/PeerSelector'
import MultiplesTable from '../components/relative/MultiplesTable'
import FootballFieldChart from '../components/charts/FootballFieldChart'
import PeerComparisonChart from '../components/charts/PeerComparisonChart'
import AppSidebar from '../components/AppSidebar'

const SECTIONS = [
  { id: 'DCF Valuation', label: 'DCF Model', icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )},
  { id: 'Relative Valuation', label: 'Relative Valuation', icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )},
]

const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥' }

function getVerdict(implied, current) {
  if (!implied || !current) return null
  const upside = (implied - current) / current
  if (upside > 0.15) return { label: 'OUTPERFORM', color: 'bg-[#1B3A8A] text-white', upside }
  if (upside > 0.05) return { label: 'MARKET PERFORM', color: 'bg-yellow-500 text-white', upside }
  if (upside > -0.05) return { label: 'HOLD', color: 'bg-gray-500 text-white', upside }
  return { label: 'UNDERPERFORM', color: 'bg-red-600 text-white', upside }
}

function ValuationRangeBar({ label, low, high, current }) {
  if (!low || !high || !current) return null
  const min = Math.min(low, current) * 0.9
  const max = Math.max(high, current) * 1.1
  const range = max - min
  const lowPct = ((low - min) / range) * 100
  const highPct = ((high - min) / range) * 100
  const currPct = ((current - min) / range) * 100

  return (
    <div className="mb-3">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-xs text-gray-500 font-medium">{label}</span>
        <span className="text-xs text-gray-400">${low?.toFixed(0)} – ${high?.toFixed(0)}</span>
      </div>
      <div className="relative h-2 bg-gray-100 rounded-full">
        <div
          className="absolute h-full bg-blue-200 rounded-full"
          style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
        />
        <div
          className="absolute w-0.5 h-4 bg-blue-700 rounded-full -top-1"
          style={{ left: `${currPct}%` }}
          title={`Current: $${current?.toFixed(2)}`}
        />
      </div>
    </div>
  )
}

export default function ValuationPage() {
  const { ticker, companyInfo, dcf: ctxDCF, relativeValuation: ctxRelVal } = useAnalysis()
  const dispatch = useAnalysisDispatch()
  const navigate = useNavigate()

  const [section, setSection] = useState('DCF Valuation')

  const [dcfAssumptions, setDcfAssumptions] = useState({
    revenue_growth_rates: [0.08, 0.07, 0.06],
    ebitda_margin: 0.20,
    capex_pct_revenue: 0.05,
    da_pct_revenue: 0.04,
    nwc_pct_revenue: 0.10,
    tax_rate: 0.21,
    risk_free_rate: 0.043,
    equity_risk_premium: 0.055,
    terminal_growth_rate: 0.025,
    exit_multiple: 12,
  })
  const [dcf, setDcf] = useState(ctxDCF)
  const [dcfLoading, setDcfLoading] = useState(false)
  const [dcfError, setDcfError] = useState('')

  const [peers, setPeers] = useState([])
  const [relVal, setRelVal] = useState(ctxRelVal)
  const [relLoading, setRelLoading] = useState(false)
  const [relError, setRelError] = useState('')

  useEffect(() => {
    if (ticker && !peers.length) {
      getPeers(ticker).then((d) => setPeers(d.peers || [])).catch(() => {})
    }
  }, [ticker])

  const handleRunDCF = async () => {
    if (!ticker) return
    setDcfLoading(true)
    setDcfError('')
    try {
      const data = await runDCF(ticker, dcfAssumptions)
      setDcf(data)
      dispatch({ type: 'SET_DCF', payload: data })
    } catch (e) {
      setDcfError(e.response?.data?.detail || 'DCF failed')
    } finally {
      setDcfLoading(false)
    }
  }

  const handleRunRelVal = async () => {
    if (!ticker) return
    setRelLoading(true)
    setRelError('')
    try {
      const data = await runRelativeValuation(ticker, peers.length ? peers : null)
      setRelVal(data)
      dispatch({ type: 'SET_RELATIVE_VALUATION', payload: data })
    } catch (e) {
      setRelError(e.response?.data?.detail || 'Relative valuation failed')
    } finally {
      setRelLoading(false)
    }
  }

  const sym = CURRENCY_SYMBOLS[companyInfo?.currency] || '$'
  const currentPrice = companyInfo?.current_price
  const dcfPrice = dcf?.intrinsic_value_per_share || dcf?.implied_price
  const relValPrice = relVal?.implied_valuations
    ? Object.values(relVal.implied_valuations).reduce((acc, v) => acc + (v.implied_price || 0), 0) /
      Object.values(relVal.implied_valuations).filter(v => v.implied_price).length
    : null

  const fairValue = dcfPrice ?? relValPrice
  const verdict = getVerdict(fairValue, currentPrice)

  const footballField = relVal?.football_field || []
  const dcfRange = dcf
    ? { low: dcfPrice ? dcfPrice * 0.9 : null, high: dcfPrice ? dcfPrice * 1.1 : null }
    : null

  if (!ticker) {
    return (
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 flex bg-gray-50 min-h-[calc(100vh-3.5rem)]">
        <AppSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-4">No company analyzed yet.</p>
            <button onClick={() => navigate('/')} className="btn-primary">Analyze a Company</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 flex bg-[#F8FAFC] min-h-[calc(100vh-3.5rem)]">
      {/* App Sidebar */}
      <AppSidebar />

      {/* Valuation sub-sidebar */}
      <div className="w-44 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="px-3 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
              {ticker?.slice(0, 2)}
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900">{ticker}</p>
              <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Equity Research</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-3 space-y-0.5">
          {SECTIONS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-left transition-colors rounded-lg mx-1 ${
                section === id
                  ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-600 font-semibold'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
          <button className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-left text-gray-400 hover:text-gray-600 rounded-lg mx-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Sensitivity
          </button>
          <button className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-left text-gray-400 hover:text-gray-600 rounded-lg mx-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Peer Comparison
          </button>
          <button className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-left text-gray-400 hover:text-gray-600 rounded-lg mx-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Summary
          </button>
        </nav>

        <div className="p-3 border-t border-gray-100">
          <button
            onClick={() => navigate('/report')}
            className="w-full py-2 px-3 rounded-lg bg-[#1B3A8A] text-white text-xs font-semibold
                       hover:bg-[#152e70] transition-colors flex items-center justify-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Report
          </button>
        </div>
      </div>

      {/* Main content + right panel */}
      <div className="flex flex-1 min-w-0">
        {/* Scrollable main */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-0.5">Valuation Analysis</h1>
            {companyInfo && (
              <p className="text-sm text-gray-400">
                {companyInfo.name} ({companyInfo.ticker}) | Sector: {companyInfo.sector || 'N/A'}
              </p>
            )}
          </div>

          {/* ======================== DCF Section ======================== */}
          {section === 'DCF Valuation' && (
            <div className="space-y-5">
              {/* Inputs */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h2 className="font-bold text-gray-900">Discounted Cash Flow (DCF) Model</h2>
                  </div>
                  <span className="text-[10px] font-bold tracking-wider px-2 py-1 bg-blue-50 text-blue-700 rounded uppercase">
                    5-Year Projection
                  </span>
                </div>
                <div className="p-6">
                  <DCFInputs assumptions={dcfAssumptions} onChange={setDcfAssumptions} />
                  <button
                    onClick={handleRunDCF}
                    disabled={dcfLoading}
                    className="btn-primary w-full mt-4"
                  >
                    {dcfLoading ? 'Calculating...' : 'Run DCF Model'}
                  </button>
                  {dcfError && <p className="text-red-500 text-xs mt-2">{dcfError}</p>}
                </div>
              </div>

              {dcfLoading && <LoadingSpinner message="Running DCF model..." />}

              {dcf && !dcfLoading && (
                <>
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <DCFResults dcf={dcf} />
                  </div>

                  {/* WACC + Terminal */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">WACC (%)</div>
                      <div className="text-3xl font-bold text-gray-900">
                        {dcf.wacc ? `${(dcf.wacc * 100).toFixed(1)}%` : '—'}
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Terminal Growth Rate</div>
                      <div className="text-3xl font-bold text-gray-900">
                        {(dcfAssumptions.terminal_growth_rate * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-5 border-l-4 border-l-blue-600">
                      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">DCF Intrinsic Value</div>
                      <div className="text-3xl font-bold text-blue-700">
                        {dcfPrice ? `${sym}${dcfPrice.toFixed(2)}` : '—'}
                      </div>
                    </div>
                  </div>

                  {/* WACC Breakdown */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="font-bold text-gray-900 mb-4">WACC Breakdown</h2>
                    <WACCBreakdown wacc={dcf.wacc} />
                  </div>

                  {/* Sensitivity */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                      Sensitivity Analysis: WACC vs. Terminal Growth
                    </h2>
                    <p className="text-xs text-gray-400 mb-4">
                      Implied share price at different WACC and terminal growth rate combinations
                    </p>
                    <SensitivityHeatmap
                      sensitivity={dcf.sensitivity}
                      currentPrice={companyInfo?.current_price}
                    />
                  </div>
                </>
              )}

              {!dcf && !dcfLoading && (
                <div className="bg-white rounded-xl border border-gray-200 text-center py-16 text-gray-400">
                  Configure inputs and run the DCF model to see results
                </div>
              )}
            </div>
          )}

          {/* ======================== Relative Valuation ======================== */}
          {section === 'Relative Valuation' && (
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <h2 className="font-bold text-gray-900">Relative Valuation &amp; Peer Comparison</h2>
                </div>
                <div className="flex flex-col md:flex-row md:items-end gap-4">
                  <div className="flex-1">
                    <PeerSelector peers={peers} onChange={setPeers} />
                  </div>
                  <button
                    onClick={handleRunRelVal}
                    disabled={relLoading}
                    className="btn-primary flex-shrink-0"
                  >
                    {relLoading ? 'Fetching peers...' : 'Run Relative Valuation'}
                  </button>
                </div>
                {relError && <p className="text-red-500 text-xs mt-2">{relError}</p>}
              </div>

              {relLoading && <LoadingSpinner message="Fetching peer company data..." />}

              {relVal && !relLoading && (
                <>
                  {relVal.peers && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h2 className="font-bold text-gray-900 mb-4">Peer Comparables Table</h2>
                      <MultiplesTable
                        peers={relVal.peers}
                        targetTicker={ticker}
                        targetMultiples={relVal.target_multiples}
                        peerSummary={relVal.multiples_summary}
                      />
                    </div>
                  )}

                  {Object.keys(relVal.implied_valuations || {}).length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h2 className="font-bold text-gray-900 mb-2 text-xs uppercase tracking-wider text-gray-400">
                        Multiple Implied Valuation
                      </h2>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
                        {Object.values(relVal.implied_valuations).map((v) => {
                          const upside = currentPrice
                            ? (v.implied_price / currentPrice - 1)
                            : null
                          return (
                            <div key={v.label} className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                              <p className="text-xs text-gray-500 mb-1">{v.label}</p>
                              <p className="text-lg font-bold text-gray-900">{sym}{v.implied_price?.toFixed(2)}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{v.multiple_used}x</p>
                              {upside != null && (
                                <p className={`text-xs font-semibold mt-1 ${upside > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {upside > 0 ? '+' : ''}{(upside * 100).toFixed(1)}%
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {relVal.football_field?.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h2 className="font-bold text-gray-900 mb-4">Football Field — Valuation Range</h2>
                      <FootballFieldChart
                        footballField={relVal.football_field}
                        currentPrice={relVal.current_price}
                      />
                    </div>
                  )}

                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="font-bold text-gray-900 mb-4">Target vs Peer Median Multiples</h2>
                    <PeerComparisonChart
                      targetMultiples={relVal.target_multiples}
                      peerSummary={relVal.multiples_summary}
                    />
                  </div>
                </>
              )}

              {!relVal && !relLoading && (
                <div className="bg-white rounded-xl border border-gray-200 text-center py-16 text-gray-400">
                  Select peers and run relative valuation
                </div>
              )}
            </div>
          )}

          {/* Nav */}
          <div className="flex justify-between pt-2">
            <button onClick={() => navigate('/forecast')} className="btn-secondary">← Forecast</button>
            <button onClick={() => navigate('/one-pager')} className="btn-primary">One Pager →</button>
          </div>
        </div>

        {/* Right panel — Valuation Summary */}
        <div className="w-72 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
          <div className="p-5 space-y-5">
            {/* Price header */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Current Price</div>
                <div className="text-xl font-bold text-gray-900">
                  {currentPrice ? `${sym}${currentPrice.toFixed(2)}` : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Fair Value Est.</div>
                <div className="text-xl font-bold text-blue-700">
                  {fairValue ? `${sym}${fairValue.toFixed(2)}` : '—'}
                  {fairValue && currentPrice && (
                    <span className={`ml-1 text-xs font-semibold ${fairValue > currentPrice ? 'text-emerald-600' : 'text-red-500'}`}>
                      ({fairValue > currentPrice ? '+' : ''}{((fairValue / currentPrice - 1) * 100).toFixed(1)}%)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Valuation Range */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                Valuation Range Comparison
              </h3>
              {currentPrice && (
                <p className="text-[10px] text-gray-400 mb-3">CURRENT: {sym}{currentPrice.toFixed(2)}</p>
              )}

              {dcfRange?.low && dcfRange?.high && (
                <ValuationRangeBar
                  label="DCF Model"
                  low={dcfRange.low}
                  high={dcfRange.high}
                  current={currentPrice}
                />
              )}
              {footballField.map((row) => (
                <ValuationRangeBar
                  key={row.label}
                  label={row.label}
                  low={row.low}
                  high={row.high}
                  current={currentPrice}
                />
              ))}
              {!dcfRange?.low && footballField.length === 0 && (
                <p className="text-xs text-gray-400 italic">Run DCF or Relative Valuation to see ranges</p>
              )}
            </div>

            {/* Analyst Verdict */}
            {verdict && (
              <div className={`rounded-xl p-4 ${verdict.color}`}>
                <div className="text-[10px] font-bold tracking-widest uppercase opacity-70 mb-1">
                  Analyst Verdict
                </div>
                <div className="text-2xl font-black tracking-tight mb-1">{verdict.label}</div>
                <div className="text-xs opacity-80 mb-3">Weighted Fair Value Recommendation</div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-bold">{fairValue ? `${sym}${fairValue.toFixed(2)}` : '—'}</div>
                  </div>
                  {verdict.upside != null && (
                    <div className="flex items-center gap-1 text-xs font-bold bg-white/20 px-2 py-1 rounded-lg">
                      {verdict.upside > 0 ? '▲' : '▼'} {Math.abs(verdict.upside * 100).toFixed(1)}% Upside
                    </div>
                  )}
                </div>
                {dcf && relVal && (
                  <div className="mt-3 space-y-1 text-xs opacity-80">
                    <div className="flex justify-between">
                      <span>DCF Weighting</span>
                      <span className="font-semibold">60%</span>
                    </div>
                    <div className="h-1 bg-white/20 rounded-full">
                      <div className="h-full bg-white/60 rounded-full" style={{ width: '60%' }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span>Relative Weighting</span>
                      <span className="font-semibold">40%</span>
                    </div>
                    <div className="h-1 bg-white/20 rounded-full">
                      <div className="h-full bg-white/60 rounded-full" style={{ width: '40%' }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Key Investment Risks */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                Key Investment Risks
              </h3>
              <ul className="space-y-2">
                {[
                  'Macroeconomic slowdown impacting revenue growth assumptions.',
                  'Regulatory pressure on core business segments.',
                  'Supply chain and margin compression risks.',
                ].map((risk, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
