import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysisDispatch } from '../context/AnalysisContext'
import { analyzeCompany } from '../api/client'
import api from '../api/client'

const SECTORS = [
  'All','Technology','Financial Services','Consumer Cyclical','Healthcare',
  'Energy','Industrials','Basic Materials','Consumer Defensive',
  'Real Estate','Communication Services','Utilities',
]

const SORT_COLS = [
  { key: 'market_cap_b', label: 'Mkt Cap' },
  { key: 'pe', label: 'P/E' },
  { key: 'pb', label: 'P/B' },
  { key: 'roe', label: 'ROE' },
  { key: 'net_margin', label: 'Net Margin' },
  { key: 'revenue_growth', label: 'Rev Growth' },
  { key: 'change_pct', label: '% Chg' },
]

function pct(v) { return v != null ? `${(v * 100).toFixed(1)}%` : '—' }
function fmt1(v) { return v != null ? v.toFixed(1) : '—' }

export default function ScreenerPage() {
  const [sector, setSector] = useState('All')
  const [minPE, setMinPE] = useState('')
  const [maxPE, setMaxPE] = useState('')
  const [minMcap, setMinMcap] = useState('')
  const [maxMcap, setMaxMcap] = useState('')
  const [limit, setLimit] = useState(50)
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(false)
  const [sortKey, setSortKey] = useState('market_cap_b')
  const [sortAsc, setSortAsc] = useState(false)
  const [analyzingTicker, setAnalyzingTicker] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const dispatch = useAnalysisDispatch()

  const runScreener = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit })
      if (sector && sector !== 'All') params.append('sector', sector)
      if (minPE) params.append('min_pe', minPE)
      if (maxPE) params.append('max_pe', maxPE)
      if (minMcap) params.append('min_mcap_b', minMcap)
      if (maxMcap) params.append('max_mcap_b', maxMcap)
      const { data } = await api.get(`/screener?${params}`)
      setStocks(data.stocks || [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Screener failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [sector, minPE, maxPE, minMcap, maxMcap, limit])

  const handleSort = (key) => {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const sorted = [...stocks].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    return sortAsc ? av - bv : bv - av
  })

  const handleAnalyze = async (ticker) => {
    setAnalyzingTicker(ticker)
    try {
      const data = await analyzeCompany(ticker)
      dispatch({ type: 'SET_ANALYSIS', payload: data })
      dispatch({ type: 'SET_TICKER', payload: ticker })
      navigate('/chart')
    } finally {
      setAnalyzingTicker(null)
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Nifty 500 Screener</h1>
        <p className="text-sm text-gray-500">
          Filter and sort across Nifty 500 stocks. Click a stock to run full analysis.
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Sector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">Sector</label>
            <select
              value={sector}
              onChange={e => setSector(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none
                         focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* PE Range */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">Min P/E</label>
            <input
              type="number"
              value={minPE}
              onChange={e => setMinPE(e.target.value)}
              placeholder="e.g. 5"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none
                         focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">Max P/E</label>
            <input
              type="number"
              value={maxPE}
              onChange={e => setMaxPE(e.target.value)}
              placeholder="e.g. 40"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none
                         focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Market cap */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">Min MCap (₹B)</label>
            <input
              type="number"
              value={minMcap}
              onChange={e => setMinMcap(e.target.value)}
              placeholder="e.g. 100"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none
                         focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">Max MCap (₹B)</label>
            <input
              type="number"
              value={maxMcap}
              onChange={e => setMaxMcap(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none
                         focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Limit + Run */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">Stocks</label>
            <div className="flex gap-2">
              <select
                value={limit}
                onChange={e => setLimit(Number(e.target.value))}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none"
              >
                {[25, 50, 100, 200, 500].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <button
                onClick={runScreener}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg
                           hover:bg-blue-700 transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                {loading ? '...' : 'Run'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading && (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-gray-500 text-sm">Fetching Nifty 500 data from Yahoo Finance…</p>
          <p className="text-gray-400 text-xs mt-1">This may take 30–60 seconds for large requests.</p>
        </div>
      )}

      {!loading && stocks.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">{sorted.length} stocks</span>
            <span className="text-xs text-gray-400">Click column headers to sort</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400 min-w-[160px]">Company</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Sector</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Price (₹)</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400 cursor-pointer hover:text-blue-600"
                      onClick={() => handleSort('change_pct')}>
                    1D % {sortKey === 'change_pct' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  {SORT_COLS.map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400
                                 cursor-pointer hover:text-blue-600 whitespace-nowrap"
                    >
                      {col.label} {sortKey === col.key ? (sortAsc ? '↑' : '↓') : ''}
                    </th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => {
                  const chg = s.change_pct
                  const isPos = chg > 0
                  const isNeg = chg < 0
                  return (
                    <tr key={s.ticker}
                        className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors cursor-pointer"
                        onClick={() => handleAnalyze(s.ticker)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{s.ticker.replace('.NS', '')}</div>
                        <div className="text-[10px] text-gray-400 truncate max-w-[140px]">{s.name}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{s.sector !== 'N/A' ? s.sector : '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900">
                        {s.price != null ? `₹${s.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${isPos ? 'text-emerald-600' : isNeg ? 'text-red-500' : 'text-gray-400'}`}>
                        {chg != null ? `${isPos ? '+' : ''}${chg.toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                        {s.market_cap_b != null ? `₹${s.market_cap_b.toFixed(0)}B` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600">{fmt1(s.pe)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600">{fmt1(s.pb)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600">{pct(s.roe)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600">{pct(s.net_margin)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600">{pct(s.revenue_growth)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600">{chg != null ? `${isPos ? '+' : ''}${chg.toFixed(2)}%` : '—'}</td>
                      <td className="px-4 py-3">
                        <button
                          disabled={analyzingTicker === s.ticker}
                          className="px-3 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700
                                     hover:bg-blue-100 transition-colors disabled:opacity-50 whitespace-nowrap"
                          onClick={e => { e.stopPropagation(); handleAnalyze(s.ticker) }}
                        >
                          {analyzingTicker === s.ticker ? '...' : 'Analyze'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && stocks.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm font-medium">Set your filters and click <strong>Run</strong> to screen stocks.</p>
          <p className="text-gray-400 text-xs mt-1">Leave filters blank to load all stocks.</p>
        </div>
      )}
    </div>
  )
}
