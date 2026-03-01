import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysis } from '../context/AnalysisContext'
import FinancialTable from '../components/FinancialTable'
import RevenueEarningsChart from '../components/charts/RevenueEarningsChart'
import MarginChart from '../components/charts/MarginChart'
import StockPriceChart from '../components/charts/StockPriceChart'

function fmt(v, decimals = 1) {
  if (v == null) return '—'
  const abs = Math.abs(v)
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(decimals)}T`
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(decimals)}B`
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(decimals)}M`
  return `$${v.toFixed(2)}`
}
function pct(v) { return v != null ? `${(v * 100).toFixed(1)}%` : '—' }

function KPICard({ label, value, sub, color }) {
  return (
    <div className="metric-card">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

const STATEMENT_TABS = ['Income Statement', 'Balance Sheet', 'Cash Flow']

export default function FinancialsPage() {
  const { companyInfo, financials, ratios, historicalPrices, historicalMetrics } = useAnalysis()
  const [tab, setTab] = useState('Income Statement')
  const navigate = useNavigate()

  if (!companyInfo && !financials) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">No data loaded yet.</p>
        <button onClick={() => navigate('/')} className="btn-primary">Go to Home</button>
      </div>
    )
  }

  const prof = ratios?.profitability || {}
  const liq = ratios?.liquidity || {}
  const solv = ratios?.solvency || {}
  const raw = ratios?.raw_values || {}

  const stmtMap = {
    'Income Statement': financials?.income_statement,
    'Balance Sheet': financials?.balance_sheet,
    'Cash Flow': financials?.cash_flow,
  }

  return (
    <div className="space-y-6">
      {/* Company header */}
      {companyInfo && (
        <div className="card">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">{companyInfo.name}</h1>
                <span className="px-2.5 py-0.5 bg-primary-100 text-primary-700 rounded-md font-mono text-sm font-semibold">
                  {companyInfo.ticker}
                </span>
              </div>
              <p className="text-gray-500 text-sm">{companyInfo.sector} · {companyInfo.industry} · {companyInfo.country}</p>
              {companyInfo.description && (
                <p className="text-gray-600 text-sm mt-3 max-w-3xl line-clamp-3">{companyInfo.description}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-3xl font-bold text-gray-900">${companyInfo.current_price?.toFixed(2)}</p>
              <p className="text-sm text-gray-400">{companyInfo.currency}</p>
              <p className="text-sm text-gray-500 mt-1">
                Mkt Cap: {fmt(companyInfo.market_cap)} · Beta: {companyInfo.beta?.toFixed(2) ?? '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPI strip */}
      {ratios && (
        <div>
          <h2 className="section-title">Key Metrics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard label="Revenue" value={fmt(raw.revenue)} />
            <KPICard label="EBITDA" value={fmt(raw.ebitda)} sub={`${pct(prof.ebitda_margin)} margin`} />
            <KPICard label="Net Income" value={fmt(raw.net_income)} sub={`${pct(prof.net_margin)} margin`} />
            <KPICard label="ROE" value={pct(prof.roe)} color={prof.roe > 0.15 ? 'text-emerald-600' : 'text-gray-900'} />
            <KPICard label="D/E Ratio" value={solv.debt_to_equity?.toFixed(2) ?? '—'} />
            <KPICard label="Current Ratio" value={liq.current_ratio?.toFixed(2) ?? '—'} color={liq.current_ratio > 1.5 ? 'text-emerald-600' : 'text-amber-600'} />
          </div>
        </div>
      )}

      {/* Revenue & Earnings chart */}
      {historicalMetrics?.length > 0 && (
        <div className="card">
          <h2 className="section-title">Revenue & Net Income</h2>
          <RevenueEarningsChart historicalMetrics={historicalMetrics} />
        </div>
      )}

      {/* Margin trends */}
      {historicalMetrics?.length > 0 && (
        <div className="card">
          <h2 className="section-title">Margin Trends</h2>
          <MarginChart historicalMetrics={historicalMetrics} />
        </div>
      )}

      {/* Financial statements */}
      <div className="card">
        <div className="flex gap-6 border-b border-gray-100 mb-6">
          {STATEMENT_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm transition-colors ${tab === t ? 'tab-active' : 'tab-inactive'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <FinancialTable data={stmtMap[tab]} />
      </div>

      {/* Ratios detail */}
      {ratios && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: 'Profitability',
              rows: [
                ['Gross Margin', pct(prof.gross_margin)],
                ['EBITDA Margin', pct(prof.ebitda_margin)],
                ['Operating Margin', pct(prof.operating_margin)],
                ['Net Margin', pct(prof.net_margin)],
                ['ROE', pct(prof.roe)],
                ['ROA', pct(prof.roa)],
                ['ROIC', pct(prof.roic)],
              ],
            },
            {
              title: 'Liquidity',
              rows: [
                ['Current Ratio', liq.current_ratio?.toFixed(2)],
                ['Quick Ratio', liq.quick_ratio?.toFixed(2)],
                ['Cash Ratio', liq.cash_ratio?.toFixed(2)],
              ],
            },
            {
              title: 'Solvency',
              rows: [
                ['Debt / Equity', solv.debt_to_equity?.toFixed(2)],
                ['Debt / Assets', pct(solv.debt_to_assets)],
                ['Interest Coverage', solv.interest_coverage ? `${solv.interest_coverage.toFixed(1)}x` : '—'],
                ['Net Debt', fmt(solv.net_debt)],
              ],
            },
            {
              title: 'Market',
              rows: [
                ['Trailing P/E', companyInfo?.trailing_pe?.toFixed(1)],
                ['Forward P/E', companyInfo?.forward_pe?.toFixed(1)],
                ['52W High', companyInfo?.fifty_two_week_high ? `$${companyInfo.fifty_two_week_high.toFixed(2)}` : '—'],
                ['52W Low', companyInfo?.fifty_two_week_low ? `$${companyInfo.fifty_two_week_low.toFixed(2)}` : '—'],
                ['Dividend Yield', pct(companyInfo?.dividend_yield)],
              ],
            },
          ].map(({ title, rows }) => (
            <div key={title} className="card">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">{title}</h3>
              {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className="text-xs font-medium text-gray-800">{value ?? '—'}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Stock price chart */}
      {historicalPrices?.length > 0 && (
        <div className="card">
          <h2 className="section-title">5-Year Price History</h2>
          <StockPriceChart historicalPrices={historicalPrices} />
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-end">
        <button onClick={() => navigate('/forecast')} className="btn-primary">
          Next: Forecast →
        </button>
      </div>
    </div>
  )
}
