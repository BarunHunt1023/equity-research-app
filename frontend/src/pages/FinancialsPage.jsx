import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysis } from '../context/AnalysisContext'
import FinancialTable from '../components/FinancialTable'
import ScreenerTable from '../components/ScreenerTable'
import RevenueEarningsChart from '../components/charts/RevenueEarningsChart'
import MarginChart from '../components/charts/MarginChart'
import TradingChart from '../components/charts/TradingChart'
import NewsFeed from '../components/NewsFeed'
import ShareholdingChart from '../components/charts/ShareholdingChart'
import AppSidebar from '../components/AppSidebar'

const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥' }

function getCurrencySymbol(currency) {
  return CURRENCY_SYMBOLS[currency] || currency || '$'
}

function fmt(v, currency = 'USD', unit = null) {
  if (v == null) return '—'
  const sym = getCurrencySymbol(currency)
  if (unit === 'Cr') {
    const abs = Math.abs(v)
    if (abs >= 100000) return `${sym}${(v / 100000).toFixed(1)}L Cr`
    if (abs >= 1) return `${sym}${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`
    return `${sym}${v.toFixed(2)} Cr`
  }
  const abs = Math.abs(v)
  if (abs >= 1e12) return `${sym}${(v / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `${sym}${(v / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sym}${(v / 1e6).toFixed(1)}M`
  return `${sym}${v.toFixed(2)}`
}

function pct(v) { return v != null ? `${(v * 100).toFixed(1)}%` : '—' }

const STATEMENT_TABS = [
  { key: 'Income Statement', short: 'Annual' },
  { key: 'Balance Sheet', short: 'Balance Sheet' },
  { key: 'Cash Flow', short: 'Cash Flow' },
]

const SCREENER_TABS = [
  { key: 'quarterly_results', label: 'Quarterly', title: 'Quarterly Results' },
  { key: 'profit_loss', label: 'P&L', title: 'Profit & Loss Statement' },
  { key: 'balance_sheet', label: 'Balance Sheet', title: 'Balance Sheet' },
  { key: 'cash_flow', label: 'Cashflows', title: 'Cash Flow Statement' },
]

function calcCAGR(start, end, years) {
  if (!start || !end || start <= 0 || years <= 0) return null
  return Math.pow(end / start, 1 / years) - 1
}

function CAGRPanel({ historicalMetrics }) {
  if (!historicalMetrics || historicalMetrics.length < 2) return null
  const sorted = [...historicalMetrics].sort((a, b) => (a.period > b.period ? 1 : -1))
  const last = sorted[sorted.length - 1]
  const ago3 = sorted.length >= 4 ? sorted[sorted.length - 4] : null
  const ago5 = sorted.length >= 6 ? sorted[sorted.length - 6] : null
  const first = sorted[0]

  const metrics = [
    { label: 'Revenue', key: 'revenue' },
    { label: 'EBITDA', key: 'ebitda' },
    { label: 'Net Income', key: 'net_income' },
  ]

  return (
    <div className="px-6 pb-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Historical CAGR</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Metric</th>
                {ago3 && <th className="text-right pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">3Y CAGR</th>}
                {ago5 && <th className="text-right pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">5Y CAGR</th>}
                <th className="text-right pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Since Inception</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map(({ label, key }) => {
                const cagr3 = ago3 ? calcCAGR(ago3[key], last[key], 3) : null
                const cagr5 = ago5 ? calcCAGR(ago5[key], last[key], 5) : null
                const cagrFull = calcCAGR(first[key], last[key], sorted.length - 1)
                const fmt = (v) => v != null ? (
                  <span className={`font-semibold tabular-nums ${v >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {v >= 0 ? '+' : ''}{(v * 100).toFixed(1)}%
                  </span>
                ) : <span className="text-gray-300">—</span>
                return (
                  <tr key={key} className="border-b border-gray-50">
                    <td className="py-2 text-gray-700 font-medium">{label}</td>
                    {ago3 && <td className="py-2 text-right">{fmt(cagr3)}</td>}
                    {ago5 && <td className="py-2 text-right">{fmt(cagr5)}</td>}
                    <td className="py-2 text-right">{fmt(cagrFull)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KPICard({ label, value, change, changeType, sub, mini }) {
  const changeUp = changeType === 'up'
  const changeDown = changeType === 'down'
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</span>
        {change && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded ${
            changeUp ? 'bg-emerald-50 text-emerald-600' : changeDown ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
          }`}>
            {changeUp ? '▲' : changeDown ? '▼' : ''} {change}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  )
}

function CashFlowSection({ financials, currency, unit }) {
  const f = (v) => fmt(v, currency, unit)
  const latest = financials?.cash_flow
    ? Object.values(financials.cash_flow).at(-1)
    : null

  if (!latest) return null

  const operatingCF = latest['Operating Cash Flow'] ?? latest['Cash From Operations'] ?? null
  const capex = latest['Capital Expenditure'] ?? latest['Capital Expenditures'] ?? null
  const dividends = latest['Dividends Paid'] ?? null
  const repurchases = latest['Repurchase Of Capital Stock'] ?? latest['Share Repurchases'] ?? null

  return (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-4">Cash Flow Statement</h3>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Operating Activities</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Cash from Operations</span>
              <span className="font-semibold text-gray-900">{f(operatingCF)}</span>
            </div>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Investing Activities</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Capital Expenditures</span>
              <span className={`font-semibold ${capex != null && capex < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {capex != null ? (capex < 0 ? `(${f(Math.abs(capex))})` : f(capex)) : '—'}
              </span>
            </div>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-red-400"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Financing Activities</span>
          </div>
          <div className="space-y-1">
            {dividends != null && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Dividends Paid</span>
                <span className="font-semibold text-red-600">({f(Math.abs(dividends))})</span>
              </div>
            )}
            {repurchases != null && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Share Repurchases</span>
                <span className="font-semibold text-red-600">({f(Math.abs(repurchases))})</span>
              </div>
            )}
            {dividends == null && repurchases == null && (
              <div className="text-sm text-gray-400">—</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function BalanceSheetPanel({ ratios, companyInfo, currency, unit }) {
  const f = (v) => fmt(v, currency, unit)
  const solv = ratios?.solvency || {}
  const liq = ratios?.liquidity || {}
  const raw = ratios?.raw_values || {}

  const totalAssets = raw.total_assets
  const totalLiabilities = raw.total_liabilities
  const totalEquity = totalAssets && totalLiabilities ? totalAssets - totalLiabilities : null

  return (
    <div className="space-y-4">
      {totalAssets && (
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Assets</span>
            <span className="text-sm font-bold text-gray-900">{f(totalAssets)}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: '60%' }} />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>Current</span>
            <span>Non-Current</span>
          </div>
        </div>
      )}

      {totalLiabilities && (
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Liabilities &amp; Equity</span>
            <span className="text-sm font-bold text-gray-900">{f(totalAssets)}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
            <div className="h-full bg-red-400 rounded-l-full" style={{
              width: totalAssets ? `${(totalLiabilities / totalAssets) * 100}%` : '50%'
            }} />
            <div className="h-full bg-emerald-400 rounded-r-full flex-1" />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>Liabilities {f(totalLiabilities)}</span>
            <span>Equity {totalEquity ? f(totalEquity) : '—'}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mt-2">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-xs text-gray-400 uppercase font-semibold tracking-wider mb-1">Current Ratio</div>
          <div className="text-xl font-bold text-gray-900">{liq.current_ratio?.toFixed(2) ?? '—'}x</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-xs text-gray-400 uppercase font-semibold tracking-wider mb-1">Debt to Equity</div>
          <div className="text-xl font-bold text-gray-900">{solv.debt_to_equity?.toFixed(2) ?? '—'}x</div>
        </div>
      </div>
    </div>
  )
}

function AnalystInsightPanel({ companyInfo, ratios }) {
  const prof = ratios?.profitability || {}
  const margin = prof.ebitda_margin
  const benchmark = 0.242

  return (
    <div className="bg-blue-900 text-white rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold">i</span>
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-blue-300">Analyst Insight</span>
      </div>
      <p className="text-sm text-blue-100 leading-relaxed">
        {companyInfo?.name
          ? `${companyInfo.name}'s revenue momentum is reflected in its financial profile. ${
              margin != null
                ? margin > benchmark
                  ? `EBITDA margins of ${pct(margin)} are above the sector benchmark of ${pct(benchmark)}, indicating strong operational efficiency.`
                  : `EBITDA margins of ${pct(margin)} remain below the sector benchmark of ${pct(benchmark)}, suggesting room for operational improvement.`
                : ''
            } Liquidity remains ${ratios?.liquidity?.current_ratio > 1.5 ? 'robust' : 'adequate'}, ${
              ratios?.liquidity?.current_ratio
                ? `with a current ratio of ${ratios.liquidity.current_ratio.toFixed(2)}x.`
                : '.'
            }`
          : 'Load a company to see analyst insights on revenue momentum, margin efficiency, and liquidity positioning.'
        }
      </p>
    </div>
  )
}

export default function FinancialsPage() {
  const { companyInfo, financials, ratios, historicalPrices, historicalMetrics, screenerTables, news, shareholders, dcf, relativeValuation } = useAnalysis()
  const [tab, setTab] = useState('Income Statement')
  const [stmtMode, setStmtMode] = useState('annual')
  const navigate = useNavigate()

  if (!companyInfo && !financials) {
    return (
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 flex bg-gray-50 min-h-[calc(100vh-3.5rem)]">
        <AppSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-gray-500 mb-4">No financial data loaded yet.</p>
            <button onClick={() => navigate('/')} className="btn-primary">Analyze a Company</button>
          </div>
        </div>
      </div>
    )
  }

  const prof = ratios?.profitability || {}
  const liq = ratios?.liquidity || {}
  const solv = ratios?.solvency || {}
  const raw = ratios?.raw_values || {}

  const currency = companyInfo?.currency || 'USD'
  const unit = companyInfo?.unit || null
  const sym = getCurrencySymbol(currency)
  const f = (v) => fmt(v, currency, unit)

  // Rating badge: derive from valuation upside if available
  const impliedPrice = dcf?.implied_price ?? relativeValuation?.implied_price ?? null
  const currentPrice = companyInfo?.current_price ?? companyInfo?.price ?? null
  const upside = impliedPrice && currentPrice ? (impliedPrice - currentPrice) / currentPrice : null
  const rating = upside != null
    ? upside > 0.20 ? { label: 'BUY', bg: 'bg-emerald-500', text: 'text-white' }
    : upside > 0.05 ? { label: 'OUTPERFORM', bg: 'bg-blue-600', text: 'text-white' }
    : upside > -0.05 ? { label: 'HOLD', bg: 'bg-yellow-400', text: 'text-gray-900' }
    : upside > -0.20 ? { label: 'UNDERPERFORM', bg: 'bg-orange-500', text: 'text-white' }
    : { label: 'SELL', bg: 'bg-red-600', text: 'text-white' }
    : null

  function screenerVal(tableKey, rowLabel) {
    const rows = screenerTables?.[tableKey]?.rows || []
    const row = rows.find(r => r.label === rowLabel)
    if (!row) return null
    const vals = (row.values || []).filter(v => v != null)
    return vals.length > 0 ? vals[vals.length - 1] : null
  }

  const ebitda = raw.ebitda ?? screenerVal('profit_loss', 'EBITDA')
  const netIncome = raw.net_income ?? screenerVal('profit_loss', 'Net profit')
  const fcf = raw.free_cash_flow ?? (raw.operating_cash_flow != null && raw.capex != null
    ? raw.operating_cash_flow - Math.abs(raw.capex) : null)

  const stmtMap = {
    'Income Statement': financials?.income_statement,
    'Balance Sheet': financials?.balance_sheet,
    'Cash Flow': financials?.cash_flow,
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 flex bg-[#F8FAFC] min-h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <AppSidebar />

      {/* Main content + right panel */}
      <div className="flex flex-1 min-w-0">
        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {/* Breadcrumb */}
          <div className="px-6 pt-5 pb-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
              <span className="text-blue-600">Equity Analysis</span>
              <span>/</span>
              <span>Financial Statements</span>
            </div>

            {/* Company title + actions */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">
                  {companyInfo?.name || 'Company'}{' '}
                  {companyInfo?.ticker && (
                    <span className="text-gray-400 font-normal">({companyInfo.ticker})</span>
                  )}
                </h1>
                {rating && (
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold tracking-wider ${rating.bg} ${rating.text}`}>
                    {rating.label}
                    {upside != null && (
                      <span className="ml-1.5 opacity-80">
                        {upside > 0 ? '+' : ''}{(upside * 100).toFixed(0)}%
                      </span>
                    )}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200
                                   rounded-lg bg-white hover:bg-gray-50 transition-colors text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  PDF Report
                </button>
                <button
                  onClick={() => navigate('/forecast')}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg
                             bg-emerald-600 hover:bg-emerald-700 text-white transition-colors font-semibold"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export to Excel
                </button>
              </div>
            </div>
          </div>

          {/* KPI cards */}
          {ratios && (
            <div className="px-6 pb-4 grid grid-cols-2 xl:grid-cols-4 gap-3">
              <KPICard
                label="Revenue Growth"
                value={f(raw.revenue)}
                change={prof.revenue_growth != null ? pct(prof.revenue_growth) : null}
                changeType={prof.revenue_growth >= 0 ? 'up' : 'down'}
              />
              <KPICard
                label="EBITDA Margin"
                value={prof.ebitda_margin != null ? pct(prof.ebitda_margin) : (ebitda ? f(ebitda) : '—')}
                change="LTM"
                changeType="neutral"
                sub={prof.ebitda_margin != null ? `Benchmark: 24.2%` : null}
              />
              <KPICard
                label="Return on Equity"
                value={prof.roe != null ? pct(prof.roe) : '—'}
                change={prof.roe != null ? (prof.roe >= 0.15 ? '+Strong' : '±Moderate') : null}
                changeType={prof.roe >= 0.15 ? 'up' : 'neutral'}
                sub={prof.roe != null ? `Historical Mean: ${pct(prof.roe)}` : null}
              />
              <KPICard
                label="Free Cash Flow"
                value={f(fcf)}
                change={fcf != null && fcf > 0 ? '+Record High' : null}
                changeType="up"
              />
            </div>
          )}

          {/* Financial statements */}
          <div className="px-6 pb-4">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Tabs */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
                <div className="flex gap-1">
                  {STATEMENT_TABS.map(({ key, short }) => (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        tab === key
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {short}
                    </button>
                  ))}
                </div>
                {tab === 'Income Statement' && (
                  <div className="flex gap-1 text-sm">
                    <button
                      onClick={() => setStmtMode('annual')}
                      className={stmtMode === 'annual' ? 'font-semibold text-blue-600' : 'text-gray-400'}
                    >
                      Annual
                    </button>
                    <span className="text-gray-300">·</span>
                    <button
                      onClick={() => setStmtMode('quarterly')}
                      className={stmtMode === 'quarterly' ? 'font-semibold text-gray-700' : 'text-gray-400'}
                    >
                      Quarterly
                    </button>
                  </div>
                )}
              </div>
              <div className="p-1">
                <FinancialTable
                  data={stmtMap[tab]}
                  currency={currency}
                  unit={unit}
                  viewMode="research"
                />
              </div>
            </div>
          </div>

          {/* Cash Flow Summary */}
          {financials?.cash_flow && (
            <div className="px-6 pb-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <CashFlowSection financials={financials} currency={currency} unit={unit} />
              </div>
            </div>
          )}

          {/* CAGR Summary */}
          {historicalMetrics?.length >= 2 && (
            <CAGRPanel historicalMetrics={historicalMetrics} />
          )}

          {/* Screener tables */}
          {screenerTables && SCREENER_TABS.map(({ key, title }) => (
            <div key={key} className="px-6 pb-4">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <ScreenerTable
                  title={title}
                  companyName={companyInfo?.name || ''}
                  denomination="Rs Cr"
                  viewMode="research"
                  columns={screenerTables[key]?.columns || []}
                  rows={screenerTables[key]?.rows || []}
                  trendColumns={screenerTables[key]?.trend_columns || []}
                  trendRows={screenerTables[key]?.trend_rows || []}
                />
              </div>
            </div>
          ))}

          {/* Navigation */}
          <div className="px-6 pb-8 flex justify-end">
            <button
              onClick={() => navigate('/forecast')}
              className="btn-primary"
            >
              Next: Forecast →
            </button>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-72 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
          <div className="p-5 space-y-6">
            {/* Revenue vs Net Income chart */}
            {historicalMetrics?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                  Revenue vs Net Income
                </h3>
                <div className="h-[180px]">
                  <RevenueEarningsChart
                    historicalMetrics={historicalMetrics}
                    currency={currency}
                    unit={unit}
                    viewMode="research"
                    compact
                  />
                </div>
              </div>
            )}

            {/* Balance Sheet Highlights */}
            {ratios && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                  Balance Sheet Highlights
                </h3>
                <BalanceSheetPanel
                  ratios={ratios}
                  companyInfo={companyInfo}
                  currency={currency}
                  unit={unit}
                />
              </div>
            )}

            {/* Margins chart */}
            {historicalMetrics?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                  Margin Trends
                </h3>
                <div className="h-[160px]">
                  <MarginChart
                    historicalMetrics={historicalMetrics}
                    viewMode="research"
                    compact
                  />
                </div>
              </div>
            )}

            {/* Trading Chart preview */}
            {historicalPrices?.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Price Chart
                  </h3>
                  <button
                    onClick={() => navigate('/chart')}
                    className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Full Chart
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                </div>
                <TradingChart
                  priceHistory={historicalPrices}
                  ticker={companyInfo?.ticker}
                  compact
                />
              </div>
            )}

            {/* Key ratios */}
            {ratios && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                  Key Ratios
                </h3>
                <div className="space-y-1">
                  {[
                    ['Gross Margin', pct(prof.gross_margin)],
                    ['EBITDA Margin', pct(prof.ebitda_margin)],
                    ['Net Margin', pct(prof.net_margin)],
                    ['ROE', pct(prof.roe)],
                    ['ROA', pct(prof.roa)],
                    ['D/E Ratio', solv.debt_to_equity != null ? `${solv.debt_to_equity.toFixed(2)}x` : '—'],
                    ['Trailing P/E', companyInfo?.trailing_pe?.toFixed(1) ?? '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between py-1 border-b border-gray-50">
                      <span className="text-xs text-gray-500">{label}</span>
                      <span className="text-xs font-medium text-gray-900 tabular-nums">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Shareholding Pattern */}
            {shareholders?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                  Shareholding Pattern
                </h3>
                <ShareholdingChart shareholders={shareholders} viewMode="research" />
              </div>
            )}

            {/* Analyst Insight */}
            <AnalystInsightPanel companyInfo={companyInfo} ratios={ratios} />

            {/* News Feed */}
            {news?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                  Latest News
                </h3>
                <NewsFeed news={news} maxItems={5} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
