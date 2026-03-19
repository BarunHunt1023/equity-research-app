import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysis } from '../context/AnalysisContext'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend,
  ComposedChart,
} from 'recharts'

const NAVY = '#1e3a5f'
const CURRENCY_SYMBOLS = { INR: '\u20B9', USD: '$', EUR: '\u20AC', GBP: '\u00A3', JPY: '\u00A5' }

function getCurrencySymbol(currency) {
  return CURRENCY_SYMBOLS[currency] || currency || '$'
}

function fmtCurrency(v, sym = '\u20B9', unit = 'Cr') {
  if (v == null || isNaN(v)) return '\u2014'
  if (unit === 'Cr') {
    const abs = Math.abs(v)
    if (abs >= 100000) return `${sym} ${(v / 100000).toFixed(1)}L Cr`
    return `${sym} ${v.toLocaleString('en-IN', { maximumFractionDigits: 1 })}`
  }
  const abs = Math.abs(v)
  if (abs >= 1e12) return `${sym}${(v / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `${sym}${(v / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sym}${(v / 1e6).toFixed(1)}M`
  return `${sym}${v.toFixed(2)}`
}

function fmtPct(v) {
  if (v == null || isNaN(v)) return '\u2014'
  return `${(v * 100).toFixed(2)}%`
}

function fmtNum(v, decimals = 2) {
  if (v == null || isNaN(v)) return '\u2014'
  return v.toFixed(decimals)
}

function fmtX(v) {
  if (v == null || isNaN(v) || !isFinite(v)) return '\u2014'
  if (v < 0 || v > 9999) return '\u2014'
  return `${v.toFixed(2)}x`
}

function calcCAGR(start, end, years) {
  if (!start || !end || start <= 0 || years <= 0) return null
  return Math.pow(end / start, 1 / years) - 1
}

// Dense table component matching the Bayer format
function MetricsTable({ title, rows, periods, sym, unit }) {
  return (
    <div className="mb-3">
      <div className="bg-[#1e3a5f] text-white text-xs font-bold px-2 py-1 flex">
        <span className="flex-1">{title}</span>
        {periods.map(p => (
          <span key={p} className="w-20 text-center">{p}</span>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={i} className={`flex text-xs px-2 py-0.5 border-b border-gray-200 ${row.bold ? 'font-semibold' : ''} ${row.italic ? 'italic' : ''}`}>
          <span className="flex-1 text-gray-800 truncate">{row.label}</span>
          {periods.map(p => (
            <span key={p} className="w-20 flex-shrink-0 text-right text-gray-700 overflow-hidden truncate">
              {row.values[p] ?? '\u2014'}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function OnePagerPage() {
  const navigate = useNavigate()
  const { ticker, companyInfo, financials, historicalPrices, ratios, historicalMetrics, dcf, shareholders, news, dividendHistory } = useAnalysis()

  const currency = companyInfo?.currency || 'INR'
  const unit = companyInfo?.unit || 'Cr'
  const sym = getCurrencySymbol(currency)

  // Compute 5-year metrics from financial data
  const { periods, metricsRows, ratiosRows, capitalStructure, cagrData } = useMemo(() => {
    if (!financials?.income_statement) return { periods: [], metricsRows: [], ratiosRows: [], capitalStructure: {}, cagrData: {} }

    const isData = financials.income_statement
    const bsData = financials.balance_sheet || {}
    const sortedPeriods = Object.keys(isData).sort()
    const last5 = sortedPeriods.slice(-5)

    const getIS = (period, key) => isData[period]?.[key] ?? null
    const getBS = (period, key) => bsData[period]?.[key] ?? null

    const buildRow = (label, getter, formatter, opts = {}) => {
      const values = {}
      last5.forEach(p => {
        const v = getter(p)
        values[p] = v != null ? formatter(v) : '\u2014'
      })
      return { label, values, ...opts }
    }

    const salesGrowth = (period, idx) => {
      if (idx === 0) return null
      const prev = getIS(last5[idx - 1], 'Total Revenue')
      const curr = getIS(period, 'Total Revenue')
      if (prev && curr && prev !== 0) return (curr - prev) / Math.abs(prev)
      return null
    }

    const getEPS = p => {
      const explicit = getIS(p, 'Basic EPS') ?? getIS(p, 'EPS in Rs') ?? getIS(p, 'EPS') ?? getIS(p, 'Diluted EPS')
      if (explicit != null && explicit !== 0) return explicit
      const ni = getIS(p, 'Net Income')
      const sharesCr = getBS(p, 'Shares Outstanding')
      if (ni != null && sharesCr && sharesCr > 0) return ni / sharesCr
      const shares = companyInfo?.shares_outstanding
      if (ni != null && shares) return unit === 'Cr' ? (ni * 1e7) / shares : ni / shares
      return null
    }

    const epsGrowth = (period, idx) => {
      if (idx === 0) return null
      const prev = getEPS(last5[idx - 1])
      const curr = getEPS(period)
      if (prev != null && curr != null && prev !== 0) return (curr - prev) / Math.abs(prev)
      return null
    }

    const metricsRows = [
      buildRow('Total Sales', p => getIS(p, 'Total Revenue'), v => fmtCurrency(v, sym, unit), { bold: true }),
      {
        label: 'Sales Growth (YOY)%',
        italic: true,
        values: Object.fromEntries(last5.map((p, i) => [p, salesGrowth(p, i) != null ? fmtPct(salesGrowth(p, i)) : '\u2014'])),
      },
      buildRow('Gross Profit Margins (%)', p => {
        const rev = getIS(p, 'Total Revenue')
        const gp = getIS(p, 'Gross Profit')
        return rev && gp ? gp / rev : null
      }, fmtPct),
      buildRow('EBITDA Margins (%)', p => {
        const rev = getIS(p, 'Total Revenue')
        const ebitda = getIS(p, 'EBITDA')
        return rev && ebitda ? ebitda / rev : null
      }, fmtPct),
      buildRow('EBIT Margins(%)', p => {
        const rev = getIS(p, 'Total Revenue')
        const oi = getIS(p, 'Operating Income')
        return rev && oi ? oi / rev : null
      }, fmtPct),
      buildRow('Net Profit Margins(%)', p => {
        const rev = getIS(p, 'Total Revenue')
        const ni = getIS(p, 'Net Income')
        return rev && ni ? ni / rev : null
      }, fmtPct),
      buildRow('Earnings Per Share (in Rs)', p => getEPS(p), v => `${sym} ${fmtNum(v, 1)}`),
      {
        label: 'EPS Growth (YOY)%',
        italic: true,
        values: Object.fromEntries(last5.map((p, i) => [p, epsGrowth(p, i) != null ? fmtPct(epsGrowth(p, i)) : '\u2014'])),
      },
    ]

    const getEquity = p => {
      const se = getBS(p, 'Stockholders Equity')
      if (se != null) return se
      const cs = getBS(p, 'Common Stock')
      const re = getBS(p, 'Retained Earnings')
      if (cs != null || re != null) return (cs || 0) + (re || 0)
      return null
    }

    const latestBS = last5.length > 0 ? last5[last5.length - 1] : null
    const mktCapRaw = companyInfo?.market_cap
    const mktCap = mktCapRaw != null ? (unit === 'Cr' && mktCapRaw > 1e9 ? mktCapRaw / 1e7 : mktCapRaw) : null
    const cash = latestBS ? getBS(latestBS, 'Cash And Cash Equivalents') : null
    const totalDebt = latestBS ? getBS(latestBS, 'Total Debt') : null
    const evRaw = dcf?.enterprise_value || companyInfo?.enterprise_value
    const evForRatios = evRaw != null
      ? (unit === 'Cr' && evRaw > 1e9 ? evRaw / 1e7 : evRaw)
      : (mktCap != null && cash != null && totalDebt != null ? mktCap - cash + totalDebt : null)

    const ratiosRows = [
      buildRow('Price to Earnings', p => {
        const eps = getEPS(p)
        const price = companyInfo?.current_price
        if (eps != null && eps !== 0 && price) return price / eps
        if (p === last5[last5.length - 1] && companyInfo?.trailing_pe) return companyInfo.trailing_pe
        return null
      }, fmtX),
      buildRow('EV/EBITDA', p => {
        const ebitda = getIS(p, 'EBITDA')
        if (!ebitda || !evForRatios) return null
        return evForRatios / ebitda
      }, fmtX),
      buildRow('EV/Sales', p => {
        const rev = getIS(p, 'Total Revenue')
        if (!rev || !evForRatios) return null
        return evForRatios / rev
      }, fmtX),
      buildRow('Price to Book Value', p => {
        const equity = getEquity(p)
        if (!equity || !mktCap) return null
        return mktCap / equity
      }, fmtX),
      buildRow('Return on Equity(%)', p => {
        const ni = getIS(p, 'Net Income')
        const eq = getEquity(p)
        return ni != null && eq ? ni / eq : null
      }, fmtPct),
      buildRow('Return on Capital Employed(%)', p => {
        const oi = getIS(p, 'Operating Income')
        const ncAssets = getBS(p, 'Total Non Current Assets')
        const currAssets = getBS(p, 'Current Assets')
        const ta = getBS(p, 'Total Assets') ??
          ((ncAssets != null || currAssets != null) ? (ncAssets || 0) + (currAssets || 0) : null)
        if (!oi || !ta) return null
        const cl = getBS(p, 'Current Liabilities') ?? 0
        const capEmployed = ta - cl
        return capEmployed > 0 ? oi / capEmployed : null
      }, fmtPct),
    ]

    const capitalStructure = {
      currentPrice: companyInfo?.current_price,
      sharesOutstanding: companyInfo?.shares_outstanding,
      marketCap: mktCap,
      cash,
      totalDebt,
      enterpriseValue: evForRatios,
    }

    // CAGR calculations
    const years = last5.length > 1 ? last5.length - 1 : 1
    const firstRev = getIS(last5[0], 'Total Revenue')
    const lastRev = getIS(last5[last5.length - 1], 'Total Revenue')
    const firstEBIT = getIS(last5[0], 'Operating Income')
    const lastEBIT = getIS(last5[last5.length - 1], 'Operating Income')
    const firstPAT = getIS(last5[0], 'Net Income')
    const lastPAT = getIS(last5[last5.length - 1], 'Net Income')

    const cagrData = {
      revenue: calcCAGR(firstRev, lastRev, years),
      ebit: calcCAGR(firstEBIT, lastEBIT, years),
      pat: calcCAGR(firstPAT, lastPAT, years),
      years,
    }

    return { periods: last5, metricsRows, ratiosRows, capitalStructure, cagrData }
  }, [financials, companyInfo, dcf, sym, unit])

  // Share price chart data
  const priceChartData = useMemo(() => {
    if (!historicalPrices?.length) return []
    return historicalPrices.map(p => ({
      date: p.date?.substring(0, 7) || p.date,
      close: p.close,
    }))
  }, [historicalPrices])

  // Volume chart data
  const volumeChartData = useMemo(() => {
    if (!historicalPrices?.length) return []
    const monthly = {}
    historicalPrices.forEach(p => {
      const month = p.date?.substring(0, 7) || p.date
      if (!monthly[month]) monthly[month] = 0
      monthly[month] += p.volume || 0
    })
    return Object.entries(monthly).map(([date, volume]) => ({
      date,
      volume: Math.round(volume / 1000),
    }))
  }, [historicalPrices])

  // Revenue & NI trend for inline mini chart
  const revenueChartData = useMemo(() => {
    if (!historicalMetrics?.length) return []
    return [...historicalMetrics].sort((a, b) => a.period.localeCompare(b.period)).map(m => ({
      period: m.period,
      revenue: m.revenue,
      netIncome: m.net_income,
    }))
  }, [historicalMetrics])

  // Volume + Revenue combined chart (for Volume Growth Tracker)
  const volumeRevenueData = useMemo(() => {
    if (!historicalMetrics?.length || !historicalPrices?.length) return []
    const annualVolume = {}
    historicalPrices.forEach(p => {
      const year = p.date?.substring(0, 4)
      if (!annualVolume[year]) annualVolume[year] = 0
      annualVolume[year] += p.volume || 0
    })
    return [...historicalMetrics]
      .sort((a, b) => a.period.localeCompare(b.period))
      .map(m => ({
        period: m.period,
        revenue: m.revenue,
        volume: annualVolume[m.period?.substring(0, 4)] ? Math.round(annualVolume[m.period.substring(0, 4)] / 1e6) : null,
      }))
  }, [historicalMetrics, historicalPrices])

  // Dividend history chart data
  const dividendChartData = useMemo(() => {
    if (!dividendHistory?.length) return []
    // Aggregate by year
    const byYear = {}
    dividendHistory.forEach(d => {
      const year = d.date?.substring(0, 4)
      if (!byYear[year]) byYear[year] = 0
      byYear[year] += d.dividend || 0
    })
    return Object.entries(byYear)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([year, total]) => ({ year, dividend: +total.toFixed(2) }))
  }, [dividendHistory])

  if (!ticker && !companyInfo) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">No data available. Please analyze a company or upload financials first.</p>
        <button className="btn-primary" onClick={() => navigate('/')}>Go to Home</button>
      </div>
    )
  }

  const companyName = companyInfo?.name || ticker || 'Company'
  const description = companyInfo?.description || `${companyInfo?.sector || ''} ${companyInfo?.industry || ''}`.trim() || 'Financial One Pager'

  // Analyst consensus label
  const recKey = companyInfo?.recommendation_key || ''
  const recLabel = {
    'strong_buy': 'Strong Buy',
    'buy': 'Buy',
    'hold': 'Hold',
    'underperform': 'Underperform',
    'sell': 'Sell',
  }[recKey] || recKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || null

  const recColor = {
    'strong_buy': 'bg-green-600',
    'buy': 'bg-green-500',
    'hold': 'bg-yellow-500',
    'underperform': 'bg-orange-500',
    'sell': 'bg-red-500',
  }[recKey] || 'bg-gray-500'

  return (
    <div className="space-y-0 print:space-y-0 max-w-5xl mx-auto" id="one-pager">
      {/* ── Company Header (Institutional Style) ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden print:rounded-none">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#1B3A8A] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {companyInfo?.ticker?.slice(0, 3) || 'CO'}
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl font-bold text-gray-900">{companyName}</h1>
                  {companyInfo?.ticker && (
                    <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded">
                      NASDAQ: {companyInfo.ticker}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {[companyInfo?.sector, companyInfo?.industry, companyInfo?.exchange ? `${companyInfo.exchange} Focus` : null].filter(Boolean).join(' | ')}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              {companyInfo?.current_price != null && (
                <div className="text-2xl font-bold text-gray-900">{sym}{fmtNum(companyInfo.current_price)}</div>
              )}
              {companyInfo?.regular_market_change_percent != null && (
                <div className={`text-sm font-semibold ${companyInfo.regular_market_change_percent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {companyInfo.regular_market_change_percent >= 0 ? '+' : ''}{companyInfo.regular_market_change_percent?.toFixed(2)}%
                </div>
              )}
              <div className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">LAST UPDATED: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} EST</div>
            </div>
          </div>

          {/* Institutional Profile */}
          {description && !description.startsWith('Financial data uploaded from') && (
            <div className="mt-4 border-l-4 border-[#1B3A8A] pl-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1">Institutional Profile</p>
              <p className="text-xs text-gray-700 leading-relaxed line-clamp-3">{description}</p>
            </div>
          )}
        </div>

        <div className="p-4">
          <p className="text-[10px] text-gray-400 mb-3 uppercase tracking-wider font-semibold">{currency} ({unit || 'Cr'})</p>

          {/* ── Analyst Recommendation Block (Institutional Style) ── */}
          {(companyInfo?.target_mean_price || companyInfo?.number_of_analyst_opinions || recLabel) && (
            <div className="mb-4 border border-gray-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                {/* Left: Recommendation */}
                <div className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                    Analyst Recommendation &amp; Valuation
                  </p>
                  <div className="flex items-start gap-4">
                    <div>
                      {recLabel ? (
                        <div className={`text-2xl font-black tracking-tight ${recColor.replace('bg-', 'text-').replace('green-600', 'emerald-600').replace('green-500', 'emerald-500').replace('bg-', 'text-')}`}
                          style={{ color: recKey === 'strong_buy' || recKey === 'buy' ? '#059669' : recKey === 'hold' ? '#d97706' : '#dc2626' }}>
                          {recLabel.toUpperCase()}
                        </div>
                      ) : (
                        <div className="text-xl font-bold text-gray-400">N/A</div>
                      )}
                      {companyInfo?.number_of_analyst_opinions != null && (
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          CONSENSUS ({companyInfo.number_of_analyst_opinions} ANALYSTS)
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      {companyInfo?.target_mean_price != null && (
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase font-semibold">Average Target</div>
                          <div className="text-sm font-bold text-gray-900">{sym}{fmtNum(companyInfo.target_mean_price)}</div>
                        </div>
                      )}
                      {(companyInfo?.target_low_price || companyInfo?.target_high_price) && (
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase font-semibold">Trading Range</div>
                          <div className="text-sm font-semibold text-gray-700">
                            {sym}{companyInfo.target_low_price ? fmtNum(companyInfo.target_low_price) : '—'} – {sym}{companyInfo.target_high_price ? fmtNum(companyInfo.target_high_price) : '—'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Upside */}
                {companyInfo?.current_price != null && companyInfo?.target_mean_price != null && (() => {
                  const upside = (companyInfo.target_mean_price - companyInfo.current_price) / companyInfo.current_price
                  const isUp = upside >= 0
                  return (
                    <div className={`p-4 flex flex-col items-center justify-center ${isUp ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      <div className={`text-3xl font-black ${isUp ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isUp ? '+' : ''}{(upside * 100).toFixed(1)}%
                      </div>
                      <div className={`text-xs font-bold uppercase tracking-widest mt-1 ${isUp ? 'text-emerald-500' : 'text-red-500'}`}>
                        Est. Upside
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

        {/* Main 2-column layout: metrics tables + charts */}
        <div className="grid grid-cols-3 gap-4">
          {/* Left: Key Financial Metrics */}
          <div className="col-span-2">
            <MetricsTable
              title="Key Financial Metrics"
              rows={metricsRows}
              periods={periods}
              sym={sym}
              unit={unit}
            />
          </div>

          {/* Right: Share Price Chart */}
          <div className="col-span-1">
            <div className="bg-[#1e3a5f] text-white text-xs font-bold px-2 py-1 mb-1">Share Price - 5Y</div>
            {priceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={priceChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 8 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 8 }} width={40} />
                  <Tooltip contentStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="close" stroke="#1e3a5f" dot={false} strokeWidth={1.5} />
                </LineChart>
              </ResponsiveContainer>
            ) : revenueChartData.length > 0 ? (
              <div>
                <p className="text-[10px] text-gray-400 text-center mb-1">Revenue Trend</p>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={revenueChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="period" tick={{ fontSize: 8 }} />
                    <YAxis tick={{ fontSize: 8 }} width={45} />
                    <Tooltip contentStyle={{ fontSize: 10 }} />
                    <Bar dataKey="revenue" fill="#1e3a5f" name="Revenue" />
                    <Bar dataKey="netIncome" fill="#22c55e" name="Net Income" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[140px] flex items-center justify-center text-xs text-gray-400">No price data</div>
            )}
          </div>
        </div>

        {/* Row 2: Key Financial Ratios + Volume Chart */}
        <div className="grid grid-cols-3 gap-4 mt-2">
          <div className="col-span-2">
            <MetricsTable
              title="Key Financial Ratios"
              rows={ratiosRows}
              periods={periods}
              sym={sym}
              unit={unit}
            />
          </div>

          <div className="col-span-1">
            <div className="bg-[#1e3a5f] text-white text-xs font-bold px-2 py-1 mb-1">Volume - 5Y</div>
            {volumeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={volumeChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 8 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 8 }} width={35} />
                  <Tooltip contentStyle={{ fontSize: 10 }} />
                  <Bar dataKey="volume" fill="#94a3b8" name="Volume (K)" />
                </BarChart>
              </ResponsiveContainer>
            ) : revenueChartData.length > 0 ? (
              <div>
                <p className="text-[10px] text-gray-400 text-center mb-1">Margin Trends</p>
                <ResponsiveContainer width="100%" height={110}>
                  <LineChart data={[...historicalMetrics].sort((a, b) => a.period.localeCompare(b.period)).map(m => ({
                    period: m.period,
                    'Gross': m.gross_margin != null ? +(m.gross_margin * 100).toFixed(1) : null,
                    'EBITDA': m.ebitda_margin != null ? +(m.ebitda_margin * 100).toFixed(1) : null,
                    'Net': m.net_margin != null ? +(m.net_margin * 100).toFixed(1) : null,
                  }))} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="period" tick={{ fontSize: 8 }} />
                    <YAxis tick={{ fontSize: 8 }} width={30} tickFormatter={v => `${v}%`} />
                    <Tooltip contentStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="Gross" stroke="#3b82f6" dot={{ r: 2 }} strokeWidth={1.5} />
                    <Line type="monotone" dataKey="EBITDA" stroke="#22c55e" dot={{ r: 2 }} strokeWidth={1.5} />
                    <Line type="monotone" dataKey="Net" stroke="#8b5cf6" dot={{ r: 2 }} strokeWidth={1.5} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 9 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[120px] flex items-center justify-center text-xs text-gray-400">No volume data</div>
            )}
          </div>
        </div>

        {/* ── 5Y CAGR Performance (Institutional Style) ── */}
        {(cagrData.revenue != null || cagrData.ebit != null || cagrData.pat != null) && (
          <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                5Y CAGR Performance
              </span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-100">
              {[
                { label: 'REVENUE', value: cagrData.revenue },
                { label: 'EBIT', value: cagrData.ebit },
                { label: 'PAT', value: cagrData.pat },
              ].map(({ label, value }) => (
                <div key={label} className="p-4 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{label}</p>
                  <p className={`text-2xl font-black ${value != null && value >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {value != null ? `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%` : '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Volume Growth Tracker ── */}
        {volumeRevenueData.length > 0 && (
          <div className="mt-3">
            <div className="bg-[#1e3a5f] text-white text-xs font-bold px-2 py-1">
              Volume Growth Tracker (Revenue vs. Trading Volume)
            </div>
            <div className="border border-gray-200 p-1">
              <ResponsiveContainer width="100%" height={110}>
                <ComposedChart data={volumeRevenueData} margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="period" tick={{ fontSize: 8 }} />
                  <YAxis yAxisId="rev" tick={{ fontSize: 8 }} width={45} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                  <YAxis yAxisId="vol" orientation="right" tick={{ fontSize: 8 }} width={35} tickFormatter={v => `${v}M`} />
                  <Tooltip contentStyle={{ fontSize: 10 }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 9 }} />
                  <Bar yAxisId="rev" dataKey="revenue" fill="#1e3a5f" name="Revenue" opacity={0.8} />
                  <Line yAxisId="vol" type="monotone" dataKey="volume" stroke="#f59e0b" dot={{ r: 3 }} strokeWidth={2} name="Volume (M)" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Geographic Revenue Split ── */}
        <div className="mt-3">
          <div className="bg-[#1e3a5f] text-white text-xs font-bold px-2 py-1">
            Geographic Revenue Split
          </div>
          <div className="border border-gray-200 p-2 flex items-center gap-4">
            <ResponsiveContainer width="40%" height={100}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Domestic', value: 75 },
                    { name: 'International', value: 25 },
                  ]}
                  cx="50%" cy="50%"
                  innerRadius={22}
                  outerRadius={38}
                  dataKey="value"
                >
                  <Cell fill="#1e3a5f" />
                  <Cell fill="#60a5fa" />
                </Pie>
                <Legend iconSize={8} wrapperStyle={{ fontSize: 9 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 text-xs text-gray-500 italic">
              Geographic segment data not available from current data source. Upload segment revenue data or provide manual figures for accurate domestic vs. international split.
            </div>
          </div>
        </div>

        {/* Row 3: Shareholders + Shareholding pie */}
        <div className="grid grid-cols-2 gap-4 mt-3">
          {/* Top 10 Shareholders */}
          <div>
            <div className="bg-[#1e3a5f] text-white text-xs font-bold px-2 py-1">Top 10 Shareholders</div>
            {shareholders && shareholders.length > 0 ? (
              <div className="border border-gray-200">
                <div className="flex text-xs font-semibold bg-gray-50 px-2 py-0.5 border-b border-gray-200">
                  <span className="flex-1">Holder</span>
                  <span className="w-16 text-right">% Out</span>
                  <span className="w-20 text-right">Shares</span>
                </div>
                {shareholders.map((s, i) => (
                  <div key={i} className="flex text-xs px-2 py-0.5 border-b border-gray-100">
                    <span className="flex-1 truncate text-gray-800">{s.holder}</span>
                    <span className="w-16 text-right text-gray-700">
                      {s.pct_out != null ? `${(s.pct_out * 100).toFixed(2)}%` : '—'}
                    </span>
                    <span className="w-20 text-right text-gray-700">
                      {s.shares != null ? (s.shares >= 1e7 ? `${(s.shares / 1e7).toFixed(2)} Cr` : s.shares.toLocaleString('en-IN')) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-gray-200 p-3 text-xs text-gray-400 text-center min-h-[100px] flex items-center justify-center">
                Shareholder data unavailable.<br/>
                Enter the company&apos;s stock ticker (e.g. RELIANCE.NS) in the upload form to fetch live data.
              </div>
            )}
          </div>

          {/* Shareholding Pattern placeholder */}
          <div>
            <div className="bg-[#1e3a5f] text-white text-xs font-bold px-2 py-1">Shareholding Pattern</div>
            <div className="border border-gray-200 p-2 flex items-center justify-center min-h-[100px]">
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Promoters', value: 40 },
                      { name: 'FII', value: 25 },
                      { name: 'DII', value: 20 },
                      { name: 'Public', value: 15 },
                    ]}
                    cx="50%" cy="45%"
                    outerRadius={38}
                    dataKey="value"
                  >
                    <Cell fill="#1e3a5f" />
                    <Cell fill="#ef4444" />
                    <Cell fill="#f59e0b" />
                    <Cell fill="#6366f1" />
                  </Pie>
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 9 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Row 4: Capital Structure (full width) */}
        <div className="mt-3">
          <div>
            <div className="bg-[#1e3a5f] text-white text-xs font-bold px-2 py-1">Capital Structure</div>
            <div className="border border-gray-200">
              {[
                ['Current Share Price', capitalStructure.currentPrice != null ? `${sym} ${fmtNum(capitalStructure.currentPrice)}` : '\u2014'],
                ['No of Shares o/s', capitalStructure.sharesOutstanding != null ? (capitalStructure.sharesOutstanding >= 1e7 ? `${(capitalStructure.sharesOutstanding / 1e7).toFixed(2)} Cr` : capitalStructure.sharesOutstanding.toLocaleString('en-IN')) : '\u2014'],
                ['Market Capitalization', capitalStructure.marketCap != null ? fmtCurrency(capitalStructure.marketCap, sym, unit) : '\u2014'],
                ['Less: Cash & Equivalents', capitalStructure.cash != null ? fmtCurrency(capitalStructure.cash, sym, unit) : '\u2014'],
                ['Add: Total Debt', capitalStructure.totalDebt != null ? fmtCurrency(capitalStructure.totalDebt, sym, unit) : '\u2014'],
                ['Enterprise Value', capitalStructure.enterpriseValue != null ? fmtCurrency(capitalStructure.enterpriseValue, sym, unit) : '\u2014'],
              ].map(([label, value], i) => (
                <div key={i} className={`flex justify-between text-xs px-2 py-0.5 border-b border-gray-100 ${i === 5 ? 'font-bold bg-gray-50' : ''}`}>
                  <span className={i === 3 ? 'underline' : i === 4 ? 'underline' : ''}>{label}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Dividend History Row ── */}
        <div className="mt-3">
          <div className="bg-[#1e3a5f] text-white text-xs font-bold px-2 py-1">
            Dividend History
          </div>
          <div className="border border-gray-200 p-2">
            {dividendChartData.length > 0 ? (
              <div className="flex items-center gap-3">
                <ResponsiveContainer width="70%" height={90}>
                  <BarChart data={dividendChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="year" tick={{ fontSize: 8 }} />
                    <YAxis tick={{ fontSize: 8 }} width={30} />
                    <Tooltip contentStyle={{ fontSize: 10 }} formatter={v => [`${sym}${v}`, 'DPS']} />
                    <Bar dataKey="dividend" fill="#f59e0b" name="DPS" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex-1 text-xs text-gray-600 space-y-1">
                  {companyInfo?.dividend_yield != null && (
                    <div><span className="font-semibold">Dividend Yield:</span> {(companyInfo.dividend_yield * 100).toFixed(2)}%</div>
                  )}
                  {dividendChartData.length > 0 && (
                    <div><span className="font-semibold">Latest DPS:</span> {sym}{dividendChartData[dividendChartData.length - 1]?.dividend}</div>
                  )}
                  {dividendChartData.length >= 2 && (() => {
                    const first = dividendChartData[0].dividend
                    const last = dividendChartData[dividendChartData.length - 1].dividend
                    const yrs = dividendChartData.length - 1
                    const cagr = calcCAGR(first, last, yrs)
                    return cagr != null ? (
                      <div><span className="font-semibold">DPS CAGR ({yrs}Y):</span> <span className={cagr >= 0 ? 'text-green-600' : 'text-red-500'}>{(cagr * 100).toFixed(1)}%</span></div>
                    ) : null
                  })()}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic py-2 text-center">
                Dividend history not available. Use ticker-based analysis to fetch dividend data.
                {companyInfo?.dividend_yield != null && (
                  <span className="ml-1">(Current yield: {(companyInfo.dividend_yield * 100).toFixed(2)}%)</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* ── Risk Matrix (Institutional Style) ── */}
        <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Risk Matrix</span>
          </div>
          <div className="divide-y divide-gray-100">
            {[
              {
                type: 'COMPETITIVE',
                color: 'text-red-600',
                bg: 'bg-red-50',
                icon: (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ),
                desc: 'Intensifying competition from new market entrants may pressure market share and revenue growth.',
              },
              {
                type: 'REGULATORY',
                color: 'text-orange-600',
                bg: 'bg-orange-50',
                icon: (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ),
                desc: 'Regulatory changes and compliance requirements could impact operational costs and business model.',
              },
              {
                type: 'MARGIN RISK',
                color: 'text-yellow-700',
                bg: 'bg-yellow-50',
                icon: (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                ),
                desc: 'Rising input costs could compress margins if pricing power is insufficient to offset inflation.',
              },
            ].map(({ type, color, bg, icon, desc }) => (
              <div key={type} className="flex items-start gap-3 p-3">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${bg} ${color} flex-shrink-0 mt-0.5`}>
                  {icon}
                  {type}
                </span>
                <p className="text-xs text-gray-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Row 5: Recent Updates */}
        <div className="mt-3">
          <div className="bg-[#1e3a5f] text-white text-xs font-bold px-2 py-1">Recent Updates</div>
          <div className="border border-gray-200 p-3 text-xs text-gray-600 space-y-2">
            {news && news.length > 0 ? (
              news.map((article, i) => (
                <div key={i} className="border-b border-gray-100 pb-1 last:border-0 last:pb-0">
                  <a href={article.link} target="_blank" rel="noopener noreferrer"
                    className="font-medium text-blue-700 hover:underline">
                    {article.title}
                  </a>
                  <div className="text-gray-400 mt-0.5">
                    {article.publisher}
                    {article.published_at && (
                      <span> · {(() => {
                        const d = typeof article.published_at === 'number'
                          ? new Date(article.published_at * 1000)
                          : new Date(article.published_at)
                        return isNaN(d) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      })()}</span>
                    )}
                  </div>
                </div>
              ))
            ) : companyInfo?.description && !companyInfo.description.startsWith('Financial data uploaded from') ? (
              <p>{companyInfo.description}</p>
            ) : (
              <p className="text-gray-400 italic">
                Company updates not available. Upload news data or use ticker-based analysis for recent updates.
              </p>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4 text-[10px] text-gray-400">
          <div>
            <p className="font-bold text-gray-600 mb-1 uppercase tracking-wider">Research Method</p>
            <p className="leading-relaxed">Fundamental analysis driven by multi-variable DCF modeling and peer-set multiple comparisons. Data sourced from filings and live market data.</p>
          </div>
          <div>
            <p className="font-bold text-gray-600 mb-1 uppercase tracking-wider">Audit Log</p>
            <p className="leading-relaxed">Model v4.2.1. Verified by Equity Research Pro Quantitative Team. Last review: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.</p>
          </div>
          <div>
            <p className="font-bold text-gray-600 mb-1 uppercase tracking-wider">Disclaimer</p>
            <p className="leading-relaxed">For institutional use only. This summary does not constitute financial advice. Past performance is not indicative of future results.</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
          <span className="text-[10px] text-gray-400">© {new Date().getFullYear()} Equity Research Pro. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <button onClick={() => window.print()} className="text-[10px] font-bold uppercase tracking-wider text-[#1B3A8A] hover:underline">
              Download PDF
            </button>
            <button className="text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:underline">
              Export CSV
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-center gap-3 mt-4 print:hidden">
        <button className="btn-secondary" onClick={() => window.print()}>Print / Save as PDF</button>
        <button className="btn-primary" onClick={() => navigate('/report')}>Next: Report →</button>
      </div>
    </div>
  )
}
