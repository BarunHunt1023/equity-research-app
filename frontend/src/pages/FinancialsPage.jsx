import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysis } from '../context/AnalysisContext'
import FinancialTable from '../components/FinancialTable'
import ScreenerTable from '../components/ScreenerTable'
import RevenueEarningsChart from '../components/charts/RevenueEarningsChart'
import MarginChart from '../components/charts/MarginChart'
import StockPriceChart from '../components/charts/StockPriceChart'

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
  { key: 'Income Statement', short: 'IS' },
  { key: 'Balance Sheet', short: 'BS' },
  { key: 'Cash Flow', short: 'CF' },
]

const SCREENER_TABS = [
  { key: 'quarterly_results', label: 'Quarterly Reports', title: 'Quarterly Results' },
  { key: 'profit_loss',       label: 'P&L',               title: 'Profit & Loss Statement' },
  { key: 'balance_sheet',     label: 'Balance Sheet',      title: 'Balance Sheet' },
  { key: 'cash_flow',         label: 'Cashflows',          title: 'Cash Flow Statement' },
]

export default function FinancialsPage() {
  const { companyInfo, financials, ratios, historicalPrices, historicalMetrics, screenerTables } = useAnalysis()
  const [tab, setTab] = useState('Income Statement')
  const [viewMode, setViewMode] = useState('research') // 'research' | 'terminal'
  const navigate = useNavigate()

  const t = viewMode === 'terminal'

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

  const currency = companyInfo?.currency || 'USD'
  const unit = companyInfo?.unit || null
  const sym = getCurrencySymbol(currency)
  const f = (v) => fmt(v, currency, unit)

  // Helper: get last non-null value from a screenerTables row by label
  function screenerVal(tableKey, rowLabel) {
    const rows = screenerTables?.[tableKey]?.rows || []
    const row = rows.find(r => r.label === rowLabel)
    if (!row) return null
    const vals = (row.values || []).filter(v => v != null)
    return vals.length > 0 ? vals[vals.length - 1] : null
  }

  const stmtMap = {
    'Income Statement': financials?.income_statement,
    'Balance Sheet': financials?.balance_sheet,
    'Cash Flow': financials?.cash_flow,
  }

  // Section header band shared across both themes
  const SectionBand = ({ title, children }) => (
    <div className={`flex items-center justify-between px-4 py-2.5 ${
      t
        ? 'bg-[#162032] border-b border-[#243a52]'
        : 'bg-[#0a1628]'
    }`}>
      <span className={`text-xs font-bold tracking-widest uppercase ${t ? 'text-amber-400' : 'text-white'}`}>
        {title}
      </span>
      {children}
    </div>
  )

  // Outer container: terminal = dark bg breaks out of layout padding
  const outerClass = t
    ? '-mx-4 sm:-mx-6 lg:-mx-8 -my-8 bg-[#0b1929] px-4 sm:px-6 lg:px-8 py-6 min-h-screen'
    : 'space-y-5'

  // Card wrapper per section
  const cardClass = t
    ? 'bg-[#0f1f30] border border-[#1e3048] overflow-hidden mb-1'
    : 'bg-white border border-gray-100 shadow-sm rounded-xl overflow-hidden'

  const sectionGap = t ? 'space-y-1' : 'space-y-5'

  return (
    <div className={outerClass}>
      <div className={sectionGap}>

        {/* ── View Mode Toggle ─────────────────────────────────────── */}
        <div className="flex justify-end">
          <div className={`inline-flex text-xs font-bold tracking-widest overflow-hidden border ${t ? 'border-[#243a52]' : 'border-gray-300'}`}>
            <button
              onClick={() => setViewMode('research')}
              className={`px-5 py-1.5 transition-colors ${
                viewMode === 'research'
                  ? 'bg-[#0a1628] text-white'
                  : t
                  ? 'bg-[#162032] text-slate-400 hover:text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              RESEARCH
            </button>
            <button
              onClick={() => setViewMode('terminal')}
              className={`px-5 py-1.5 transition-colors border-l ${t ? 'border-[#243a52]' : 'border-gray-300'} ${
                viewMode === 'terminal'
                  ? 'bg-[#0a1628] text-amber-400'
                  : t
                  ? 'bg-[#162032] text-slate-400 hover:text-amber-400'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              TERMINAL
            </button>
          </div>
        </div>

        {/* ── Company Header ───────────────────────────────────────── */}
        {companyInfo && (
          <div className={cardClass}>
            <div className={`px-6 py-4 ${t ? 'bg-[#0a1628] border-b border-amber-400/20' : 'bg-[#0a1628]'}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className={`text-xl font-bold text-white tracking-tight ${t ? 'font-mono' : ''}`}>
                      {companyInfo.name}
                    </h1>
                    <span className={`px-2 py-0.5 border text-xs font-mono ${t ? 'border-amber-400/50 text-amber-400' : 'border-white/30 text-white/80'}`}>
                      {companyInfo.ticker}
                    </span>
                    {t && <span className="text-green-400 text-xs font-mono">▲ EQUITY</span>}
                  </div>
                  {[companyInfo.sector, companyInfo.industry, companyInfo.country]
                    .filter(v => v && v !== 'N/A').length > 0 && (
                    <p className={`text-xs ${t ? 'text-slate-400 font-mono' : 'text-white/60'}`}>
                      {[companyInfo.sector, companyInfo.industry, companyInfo.country]
                        .filter(v => v && v !== 'N/A').join(' · ')}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  {companyInfo.current_price != null && (
                    <p className={`text-2xl font-bold tabular-nums ${t ? 'text-amber-400 font-mono' : 'text-white'}`}>
                      {sym}{companyInfo.current_price.toFixed(2)}
                    </p>
                  )}
                  <p className={`text-xs mt-0.5 ${t ? 'text-slate-400 font-mono' : 'text-white/50'}`}>
                    Mkt Cap: {f(companyInfo.market_cap)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── KPI Strip ────────────────────────────────────────────── */}
        {ratios && (
          <div className={cardClass}>
            <SectionBand title="Key Metrics" />
            <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x ${t ? 'divide-[#1e3048]' : 'divide-gray-100'}`}>
              {(() => {
                const ebitda = raw.ebitda ?? screenerVal('profit_loss', 'EBITDA')
                const netIncome = raw.net_income ?? screenerVal('profit_loss', 'Net profit')
                const screenerRoe = screenerVal('balance_sheet', 'Return on Equity')
                const roe = prof.roe != null ? pct(prof.roe) : (screenerRoe != null ? `${screenerRoe.toFixed(1)}%` : '—')
                return [
                  { label: 'Revenue', value: f(raw.revenue), sub: null },
                  { label: 'EBITDA', value: f(ebitda), sub: prof.ebitda_margin ? `${pct(prof.ebitda_margin)} margin` : null },
                  { label: 'Net Income', value: f(netIncome), sub: prof.net_margin ? `${pct(prof.net_margin)} margin` : null },
                  { label: 'ROE', value: roe, sub: null },
                  { label: 'D/E Ratio', value: solv.debt_to_equity != null ? `${solv.debt_to_equity.toFixed(2)}x` : '—', sub: null },
                  { label: 'Current Ratio', value: liq.current_ratio?.toFixed(2) ?? '—', sub: null },
                ]
              })().map(({ label, value, sub }) => (
                <div key={label} className={`px-4 py-3 ${t ? 'border-b border-[#1e3048] lg:border-b-0' : 'border-b border-gray-50 lg:border-b-0'}`}>
                  <p className={`text-xs font-semibold tracking-wider uppercase mb-1 ${t ? 'text-amber-400' : 'text-[#0a1628]'}`}>
                    {label}
                  </p>
                  <p className={`text-sm font-bold tabular-nums ${t ? 'text-white font-mono' : 'text-gray-900'}`}>
                    {value}
                  </p>
                  {sub && (
                    <p className={`text-xs mt-0.5 ${t ? 'text-slate-400' : 'text-gray-400'}`}>{sub}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Charts ───────────────────────────────────────────────── */}
        {historicalMetrics?.length > 0 && (
          <div className={`${cardClass} grid grid-cols-1 xl:grid-cols-2`}>
            <div className={`p-5 ${t ? 'border-b xl:border-b-0 xl:border-r border-[#1e3048]' : 'border-b xl:border-b-0 xl:border-r border-gray-100'}`}>
              <RevenueEarningsChart
                historicalMetrics={historicalMetrics}
                currency={currency}
                unit={unit}
                viewMode={viewMode}
              />
            </div>
            <div className="p-5">
              <MarginChart
                historicalMetrics={historicalMetrics}
                viewMode={viewMode}
              />
            </div>
          </div>
        )}

        {/* ── Financial Statements ─────────────────────────────────── */}
        <div className={cardClass}>
          <SectionBand title="Financial Statements">
            {/* Tab row inside the section band */}
            <div className="flex gap-1">
              {STATEMENT_TABS.map(({ key, short }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-3 py-0.5 text-xs font-bold tracking-wide transition-colors ${
                    tab === key
                      ? (t ? 'bg-amber-400 text-[#0a1628]' : 'bg-white text-[#0a1628]')
                      : (t ? 'text-slate-400 hover:text-amber-400' : 'text-white/60 hover:text-white')
                  }`}
                >
                  {short}
                </button>
              ))}
            </div>
          </SectionBand>
          <div className={t ? 'bg-[#0f1f30] p-4' : 'p-4'}>
            <FinancialTable
              data={stmtMap[tab]}
              currency={currency}
              unit={unit}
              viewMode={viewMode}
            />
          </div>
        </div>

        {/* ── Screener-Style Financial Tables (Stacked Vertically) ──────── */}
        {screenerTables && SCREENER_TABS.map(({ key, title }) => (
          <div key={key} className={cardClass}>
            <ScreenerTable
              title={title}
              companyName={companyInfo?.name || ''}
              denomination="Rs Cr"
              viewMode={viewMode}
              columns={screenerTables[key]?.columns || []}
              rows={screenerTables[key]?.rows || []}
              trendColumns={screenerTables[key]?.trend_columns || []}
              trendRows={screenerTables[key]?.trend_rows || []}
            />
          </div>
        ))}

        {/* ── Financial Ratios ─────────────────────────────────────── */}
        {ratios && (
          <div className={cardClass}>
            <SectionBand title="Financial Ratios" />
            <div className={`grid grid-cols-1 md:grid-cols-2 ${t ? 'divide-y md:divide-y-0 md:divide-x divide-[#1e3048]' : 'divide-y md:divide-y-0 md:divide-x divide-gray-100'}`}>
              {/* Left: Profitability */}
              <div>
                <div className={`px-4 py-1.5 text-xs font-bold tracking-widest uppercase ${t ? 'text-amber-400/70 bg-[#162032]/50 border-b border-[#1e3048]' : 'text-[#0a1628] bg-gray-50 border-b border-gray-100'}`}>
                  Profitability
                </div>
                {[
                  ['Gross Margin', pct(prof.gross_margin)],
                  ['EBITDA Margin', pct(prof.ebitda_margin)],
                  ['Operating Margin', pct(prof.operating_margin)],
                  ['Net Margin', pct(prof.net_margin)],
                  ['ROE', pct(prof.roe)],
                  ['ROA', pct(prof.roa)],
                  ['ROIC', pct(prof.roic)],
                ].map(([label, value]) => (
                  <div key={label} className={`flex justify-between px-4 py-1.5 ${t ? 'border-b border-[#1e3048]/60 hover:bg-[#162032]' : 'border-b border-gray-50 hover:bg-gray-50'}`}>
                    <span className={`text-xs ${t ? 'text-slate-400' : 'text-gray-500'}`}>{label}</span>
                    <span className={`text-xs font-medium tabular-nums ${t ? 'text-white font-mono' : 'text-gray-800'}`}>{value ?? '—'}</span>
                  </div>
                ))}
              </div>
              {/* Right: Solvency & Liquidity */}
              <div>
                <div className={`px-4 py-1.5 text-xs font-bold tracking-widest uppercase ${t ? 'text-amber-400/70 bg-[#162032]/50 border-b border-[#1e3048]' : 'text-[#0a1628] bg-gray-50 border-b border-gray-100'}`}>
                  Solvency &amp; Liquidity
                </div>
                {[
                  ['Debt / Equity', solv.debt_to_equity != null ? `${solv.debt_to_equity.toFixed(2)}x` : '—'],
                  ['Debt / Assets', pct(solv.debt_to_assets)],
                  ['Interest Coverage', solv.interest_coverage ? `${solv.interest_coverage.toFixed(1)}x` : '—'],
                  ['Net Debt', f(solv.net_debt)],
                  ['Current Ratio', liq.current_ratio?.toFixed(2) ?? '—'],
                  ['Quick Ratio', liq.quick_ratio?.toFixed(2) ?? '—'],
                  ['Cash Ratio', liq.cash_ratio?.toFixed(2) ?? '—'],
                ].map(([label, value]) => (
                  <div key={label} className={`flex justify-between px-4 py-1.5 ${t ? 'border-b border-[#1e3048]/60 hover:bg-[#162032]' : 'border-b border-gray-50 hover:bg-gray-50'}`}>
                    <span className={`text-xs ${t ? 'text-slate-400' : 'text-gray-500'}`}>{label}</span>
                    <span className={`text-xs font-medium tabular-nums ${t ? 'text-white font-mono' : 'text-gray-800'}`}>{value ?? '—'}</span>
                  </div>
                ))}
                {/* Market data */}
                <div className={`px-4 py-1.5 text-xs font-bold tracking-widest uppercase ${t ? 'text-amber-400/70 bg-[#162032]/50 border-b border-[#1e3048] border-t border-[#1e3048]' : 'text-[#0a1628] bg-gray-50 border-b border-gray-100 border-t border-gray-100'}`}>
                  Market
                </div>
                {[
                  ['Trailing P/E', companyInfo?.trailing_pe?.toFixed(1) ?? '—'],
                  ['Forward P/E', companyInfo?.forward_pe?.toFixed(1) ?? '—'],
                  ['Dividend Yield', pct(companyInfo?.dividend_yield)],
                  ['52W High', companyInfo?.fifty_two_week_high ? `${sym}${companyInfo.fifty_two_week_high.toFixed(2)}` : '—'],
                  ['52W Low', companyInfo?.fifty_two_week_low ? `${sym}${companyInfo.fifty_two_week_low.toFixed(2)}` : '—'],
                ].map(([label, value]) => (
                  <div key={label} className={`flex justify-between px-4 py-1.5 ${t ? 'border-b border-[#1e3048]/60 hover:bg-[#162032]' : 'border-b border-gray-50 hover:bg-gray-50'}`}>
                    <span className={`text-xs ${t ? 'text-slate-400' : 'text-gray-500'}`}>{label}</span>
                    <span className={`text-xs font-medium tabular-nums ${t ? 'text-white font-mono' : 'text-gray-800'}`}>{value ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Stock Price Chart ────────────────────────────────────── */}
        {historicalPrices?.length > 0 && (
          <div className={cardClass}>
            <SectionBand title="5-Year Price History" />
            <div className={t ? 'p-5 bg-[#0f1f30]' : 'p-5'}>
              <StockPriceChart historicalPrices={historicalPrices} />
            </div>
          </div>
        )}

        {/* ── Navigation ───────────────────────────────────────────── */}
        <div className="flex justify-end pt-2">
          <button
            onClick={() => navigate('/forecast')}
            className={`px-6 py-2 text-sm font-semibold tracking-wide transition-colors ${
              t
                ? 'bg-amber-400 text-[#0a1628] hover:bg-amber-300'
                : 'bg-[#0a1628] text-white hover:bg-[#0f2040]'
            }`}
          >
            Next: Forecast →
          </button>
        </div>

      </div>
    </div>
  )
}
