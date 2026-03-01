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

const SECTIONS = ['DCF Valuation', 'Relative Valuation']

export default function ValuationPage() {
  const { ticker, companyInfo, dcf: ctxDCF, relativeValuation: ctxRelVal, ratios } = useAnalysis()
  const dispatch = useAnalysisDispatch()
  const navigate = useNavigate()

  const [section, setSection] = useState('DCF Valuation')

  // DCF state
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

  // Relative valuation state
  const [peers, setPeers] = useState([])
  const [relVal, setRelVal] = useState(ctxRelVal)
  const [relLoading, setRelLoading] = useState(false)
  const [relError, setRelError] = useState('')

  // Load suggested peers on mount
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

  if (!ticker) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">No company analyzed yet.</p>
        <button onClick={() => navigate('/')} className="btn-primary">Go to Home</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Valuation Analysis</h1>
        {companyInfo && (
          <p className="text-gray-500 text-sm mt-1">
            {companyInfo.name} ({companyInfo.ticker}) · Current Price: ${companyInfo.current_price?.toFixed(2)}
          </p>
        )}
      </div>

      {/* Section tabs */}
      <div className="flex gap-6 border-b border-gray-200">
        {SECTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`pb-3 text-sm transition-colors ${section === s ? 'tab-active' : 'tab-inactive'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ======================== DCF ======================== */}
      {section === 'DCF Valuation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Inputs */}
            <div className="card lg:col-span-1">
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

            {/* Results */}
            <div className="lg:col-span-2 space-y-6">
              {dcfLoading && <LoadingSpinner message="Running DCF model..." />}
              {dcf && !dcfLoading && (
                <>
                  <div className="card">
                    <DCFResults dcf={dcf} />
                  </div>

                  <div className="card">
                    <h2 className="section-title">WACC Breakdown</h2>
                    <WACCBreakdown wacc={dcf.wacc} />
                  </div>

                  <div className="card">
                    <h2 className="section-title">Sensitivity Analysis</h2>
                    <p className="text-xs text-gray-400 mb-4">Implied share price at different WACC and terminal growth rate combinations</p>
                    <SensitivityHeatmap
                      sensitivity={dcf.sensitivity}
                      currentPrice={companyInfo?.current_price}
                    />
                  </div>
                </>
              )}
              {!dcf && !dcfLoading && (
                <div className="card text-center py-12">
                  <p className="text-gray-400">Configure inputs and run the DCF model to see results</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================== Relative Valuation ======================== */}
      {section === 'Relative Valuation' && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              <div className="flex-1">
                <PeerSelector peers={peers} onChange={setPeers} />
              </div>
              <div>
                <button
                  onClick={handleRunRelVal}
                  disabled={relLoading}
                  className="btn-primary"
                >
                  {relLoading ? 'Fetching peers...' : 'Run Relative Valuation'}
                </button>
              </div>
            </div>
            {relError && <p className="text-red-500 text-xs mt-2">{relError}</p>}
          </div>

          {relLoading && <LoadingSpinner message="Fetching peer company data..." />}

          {relVal && !relLoading && (
            <>
              {/* Implied valuations grid */}
              {Object.keys(relVal.implied_valuations || {}).length > 0 && (
                <div className="card">
                  <h2 className="section-title">Implied Price by Method</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {Object.values(relVal.implied_valuations).map((v) => {
                      const up = companyInfo?.current_price
                        ? (v.implied_price / companyInfo.current_price - 1)
                        : null
                      return (
                        <div key={v.label} className="metric-card text-center">
                          <p className="text-xs text-gray-500">{v.label}</p>
                          <p className="text-xl font-bold text-gray-900 mt-1">${v.implied_price?.toFixed(2)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{v.multiple_used}x multiple</p>
                          {up != null && (
                            <p className={`text-xs font-medium mt-1 ${up > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {up > 0 ? '+' : ''}{(up * 100).toFixed(1)}%
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Football field */}
              {relVal.football_field?.length > 0 && (
                <div className="card">
                  <h2 className="section-title">Football Field — Valuation Range</h2>
                  <FootballFieldChart
                    footballField={relVal.football_field}
                    currentPrice={relVal.current_price}
                  />
                </div>
              )}

              {/* Peer multiples comparison chart */}
              <div className="card">
                <h2 className="section-title">Target vs Peer Median Multiples</h2>
                <PeerComparisonChart
                  targetMultiples={relVal.target_multiples}
                  peerSummary={relVal.multiples_summary}
                />
              </div>

              {/* Full peer multiples table */}
              <div className="card">
                <h2 className="section-title">Peer Comparables Table</h2>
                <MultiplesTable
                  peers={relVal.peers}
                  targetTicker={ticker}
                  targetMultiples={relVal.target_multiples}
                  peerSummary={relVal.multiples_summary}
                />
              </div>
            </>
          )}

          {!relVal && !relLoading && (
            <div className="card text-center py-12">
              <p className="text-gray-400">Select peers and run relative valuation</p>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={() => navigate('/forecast')} className="btn-secondary">← Forecast</button>
        <button onClick={() => navigate('/report')} className="btn-primary">Generate Report →</button>
      </div>
    </div>
  )
}
