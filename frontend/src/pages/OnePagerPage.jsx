import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysis } from '../context/AnalysisContext'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend,
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
  if (v == null || isNaN(v)) return '\u2014'
  return `${v.toFixed(2)}x`
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
          <span className="flex-1 text-gray-800">{row.label}</span>
          {periods.map(p => (
            <span key={p} className="w-20 text-right text-gray-700">
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
  const { ticker, companyInfo, financials, historicalPrices, ratios, historicalMetrics, dcf } = useAnalysis()

  const currency = companyInfo?.currency || 'INR'
  const unit = companyInfo?.unit || 'Cr'
  const sym = getCurrencySymbol(currency)

  // Compute 5-year metrics from financial data
  const { periods, metricsRows, ratiosRows, capitalStructure } = useMemo(() => {
    if (!financials?.income_statement) return { periods: [], metricsRows: [], ratiosRows: [], capitalStructure: {} }

    const isData = financials.income_statement
    const bsData = financials.balance_sheet || {}
    const sortedPeriods = Object.keys(isData).sort()
    const last5 = sortedPeriods.slice(-5)

    // Helper to get a value from a period's data
    const getIS = (period, key) => isData[period]?.[key] ?? null
    const getBS = (period, key) => bsData[period]?.[key] ?? null

    // Build Key Financial Metrics rows
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

    // EPS: try multiple field names (screener.in may use any of these)
    const getEPS = p => getIS(p, 'Basic EPS') ?? getIS(p, 'EPS in Rs') ?? getIS(p, 'EPS') ?? getIS(p, 'Diluted EPS') ?? null

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

    // Equity: try 'Stockholders Equity', fall back to Common Stock + Retained Earnings
    const getEquity = p => {
      const se = getBS(p, 'Stockholders Equity')
      if (se != null) return se
      const cs = getBS(p, 'Common Stock')
      const re = getBS(p, 'Retained Earnings')
      if (cs != null || re != null) return (cs || 0) + (re || 0)
      return null
    }

    // Build Key Financial Ratios rows
    const ratiosRows = [
      buildRow('Price to Earnings', p => {
        const eps = getEPS(p)
        const price = companyInfo?.current_price
        return eps && price ? price / eps : null
      }, fmtX),
      buildRow('EV/EBITDA', p => {
        const ebitda = getIS(p, 'EBITDA')
        // EV in same unit as EBITDA; for uploads EV comes from YF (absolute INR) but
        // financials are in Crores — convert EV to Crores if needed
        const evRaw = dcf?.enterprise_value || companyInfo?.enterprise_value
        if (!ebitda || !evRaw) return null
        const ev = unit === 'Cr' ? evRaw / 1e7 : evRaw
        return ev / ebitda
      }, fmtX),
      buildRow('EV/Sales', p => {
        const rev = getIS(p, 'Total Revenue')
        const evRaw = dcf?.enterprise_value || companyInfo?.enterprise_value
        if (!rev || !evRaw) return null
        const ev = unit === 'Cr' ? evRaw / 1e7 : evRaw
        return ev / rev
      }, fmtX),
      buildRow('Price to Book Value', p => {
        const equity = getEquity(p)
        const shares = companyInfo?.shares_outstanding
        const price = companyInfo?.current_price
        if (!equity || !shares || !price) return null
        // equity in Crores → convert to Rs; shares is absolute
        const bvPerShare = unit === 'Cr' ? (equity * 1e7) / shares : equity / shares
        return price / bvPerShare
      }, fmtX),
      buildRow('Return on Equity(%)', p => {
        const ni = getIS(p, 'Net Income')
        const eq = getEquity(p)
        return ni != null && eq ? ni / eq : null
      }, fmtPct),
      buildRow('Return on Capital Employed(%)', p => {
        const oi = getIS(p, 'Operating Income')
        const ta = getBS(p, 'Total Assets')
        if (!oi || !ta) return null
        const cl = getBS(p, 'Current Liabilities') ?? 0
        const capEmployed = ta - cl
        return capEmployed > 0 ? oi / capEmployed : null
      }, fmtPct),
    ]

    // Capital Structure
    const latestBS = last5.length > 0 ? last5[last5.length - 1] : null
    // market_cap: from metadata or YF (YF gives INR, screener shows Crores)
    const mktCapRaw = companyInfo?.market_cap
    const mktCap = mktCapRaw != null ? (unit === 'Cr' && mktCapRaw > 1e9 ? mktCapRaw / 1e7 : mktCapRaw) : null
    const cash = latestBS ? getBS(latestBS, 'Cash And Cash Equivalents') : null
    const totalDebt = latestBS ? getBS(latestBS, 'Total Debt') : null
    // EV from YF/DCF is in INR; convert to Crores for display consistency
    const evRaw = dcf?.enterprise_value || companyInfo?.enterprise_value
    const ev = evRaw != null
      ? (unit === 'Cr' && evRaw > 1e9 ? evRaw / 1e7 : evRaw)
      : (mktCap != null && cash != null && totalDebt != null ? mktCap - cash + totalDebt : null)

    const capitalStructure = {
      currentPrice: companyInfo?.current_price,
      sharesOutstanding: companyInfo?.shares_outstanding,  // absolute number
      marketCap: mktCap,   // in display units (Cr)
      cash,
      totalDebt,
      enterpriseValue: ev, // in display units (Cr)
    }

    return { periods: last5, metricsRows, ratiosRows, capitalStructure }
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
    // Aggregate volume by month
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

  // Revenue & NI trend for an inline mini chart
  const revenueChartData = useMemo(() => {
    if (!historicalMetrics?.length) return []
    return [...historicalMetrics].sort((a, b) => a.period.localeCompare(b.period)).map(m => ({
      period: m.period,
      revenue: m.revenue,
      netIncome: m.net_income,
    }))
  }, [historicalMetrics])

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

  return (
    <div className="space-y-0 print:space-y-0 max-w-5xl mx-auto" id="one-pager">
      {/* Header */}
      <div className="bg-[#1e3a5f] text-white px-4 py-3 rounded-t-xl print:rounded-none">
        <h1 className="text-lg font-bold text-center">{companyName} - One Page Profile</h1>
        <p className="text-xs text-center text-blue-200 mt-1 max-w-xl mx-auto">{description}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-b-xl p-4 print:p-2 print:rounded-none">
        <p className="text-xs text-gray-500 mb-2 italic">{currency} ({unit || 'Cr'})</p>

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

        {/* Row 3: Shareholders placeholder + Shareholding pie */}
        <div className="grid grid-cols-2 gap-4 mt-3">
          {/* Top 10 Shareholders placeholder */}
          <div>
            <div className="bg-[#1e3a5f] text-white text-xs font-bold px-2 py-1">Top 10 Shareholders</div>
            <div className="border border-gray-200 p-3 text-xs text-gray-400 text-center min-h-[100px] flex items-center justify-center">
              Shareholder data not available for uploaded financials.<br/>
              Use ticker analysis for live shareholder data.
            </div>
          </div>

          {/* Shareholding Pattern placeholder */}
          <div>
            <div className="bg-[#1e3a5f] text-white text-xs font-bold px-2 py-1">Shareholding Pattern</div>
            <div className="border border-gray-200 p-2 flex items-center justify-center min-h-[100px]">
              <ResponsiveContainer width="100%" height={100}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Promoters', value: 40 },
                      { name: 'FII', value: 25 },
                      { name: 'DII', value: 20 },
                      { name: 'Public', value: 15 },
                    ]}
                    cx="50%" cy="50%"
                    outerRadius={35}
                    dataKey="value"
                    label={({ name }) => name}
                    labelLine={false}
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

        {/* Row 4: Managerial Remuneration + Capital Structure */}
        <div className="grid grid-cols-2 gap-4 mt-3">
          {/* Managerial Remuneration placeholder */}
          <div>
            <div className="bg-[#1e3a5f] text-white text-xs font-bold px-2 py-1">Managerial Remuneration</div>
            <div className="border border-gray-200 p-3 text-xs text-gray-400 text-center">
              Not available for uploaded financials.
            </div>
          </div>

          {/* Capital Structure */}
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

        {/* Row 5: Recent Updates */}
        <div className="mt-3">
          <div className="bg-[#1e3a5f] text-white text-xs font-bold px-2 py-1">Recent Updates</div>
          <div className="border border-gray-200 p-3 text-xs text-gray-600 space-y-2">
            {companyInfo?.description && companyInfo.description !== `Financial data uploaded from ${companyInfo?.description?.split('from ')[1]}` ? (
              <p>{companyInfo.description}</p>
            ) : (
              <p className="text-gray-400 italic">
                Company updates not available. Upload news data or use ticker-based analysis for recent updates.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#1e3a5f] text-white text-xs px-4 py-2 mt-4 rounded-b-lg flex justify-between">
          <span>Generated by Equity Research Pro</span>
          <span>By {companyInfo?.analyst || 'Analyst'}</span>
        </div>
      </div>

      {/* Print button */}
      <div className="flex justify-center gap-3 mt-4 print:hidden">
        <button className="btn-secondary" onClick={() => window.print()}>Print / Save as PDF</button>
        <button className="btn-primary" onClick={() => navigate('/report')}>Next: Report &rarr;</button>
      </div>
    </div>
  )
}
