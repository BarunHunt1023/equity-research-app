import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysisDispatch } from '../context/AnalysisContext'
import { analyzeCompany } from '../api/client'
import api from '../api/client'

const STORAGE_KEY = 'equity_watchlist'
const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥' }

function loadWatchlist() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function saveWatchlist(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export default function WatchlistPage() {
  const [tickers, setTickers] = useState(loadWatchlist)
  const [quotes, setQuotes] = useState({})
  const [loading, setLoading] = useState({})
  const [input, setInput] = useState('')
  const [fetching, setFetching] = useState(false)
  const navigate = useNavigate()
  const dispatch = useAnalysisDispatch()

  const fetchQuote = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/quote/${ticker}`)
      setQuotes(prev => ({ ...prev, [ticker]: data }))
    } catch {
      setQuotes(prev => ({ ...prev, [ticker]: null }))
    }
  }, [])

  // Fetch all quotes on mount + when tickers change
  useEffect(() => {
    tickers.forEach(t => fetchQuote(t))
    const interval = setInterval(() => tickers.forEach(t => fetchQuote(t)), 60000)
    return () => clearInterval(interval)
  }, [tickers, fetchQuote])

  const addTicker = () => {
    const t = input.trim().toUpperCase()
    if (!t || tickers.includes(t)) { setInput(''); return }
    const next = [...tickers, t]
    setTickers(next)
    saveWatchlist(next)
    setInput('')
    fetchQuote(t)
  }

  const removeTicker = (t) => {
    const next = tickers.filter(x => x !== t)
    setTickers(next)
    saveWatchlist(next)
    setQuotes(prev => { const c = { ...prev }; delete c[t]; return c })
  }

  const handleAnalyze = async (ticker) => {
    setLoading(prev => ({ ...prev, [ticker]: true }))
    try {
      const data = await analyzeCompany(ticker)
      dispatch({ type: 'SET_ANALYSIS', payload: data })
      dispatch({ type: 'SET_TICKER', payload: ticker })
      navigate('/chart')
    } finally {
      setLoading(prev => ({ ...prev, [ticker]: false }))
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Watchlist</h1>
        <p className="text-sm text-gray-500">Track your favourite stocks. Data refreshes every 60 seconds.</p>
      </div>

      {/* Add ticker */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && addTicker()}
          placeholder="Add ticker (e.g. RELIANCE.NS or AAPL)"
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none
                     focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
        />
        <button
          onClick={addTicker}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl
                     hover:bg-blue-700 transition-colors"
        >
          Add
        </button>
      </div>

      {tickers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <div className="w-14 h-14 bg-yellow-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">Your watchlist is empty.</p>
          <p className="text-gray-400 text-xs mt-1">Add tickers above to start tracking.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Ticker</th>
                <th className="text-right px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Price</th>
                <th className="text-right px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Change</th>
                <th className="text-right px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Mkt Cap</th>
                <th className="text-right px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">P/E</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {tickers.map((ticker, i) => {
                const q = quotes[ticker]
                const sym = CURRENCY_SYMBOLS[q?.currency] || '$'
                const chg = q?.change_pct
                const isPos = chg > 0
                const isNeg = chg < 0
                return (
                  <tr key={ticker} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                          {ticker.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{ticker}</div>
                          {q?.name && <div className="text-[10px] text-gray-400 truncate max-w-[120px]">{q.name}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-gray-900">
                      {q?.price != null ? `${sym}${q.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className={`px-5 py-3.5 text-right font-semibold tabular-nums ${isPos ? 'text-emerald-600' : isNeg ? 'text-red-500' : 'text-gray-400'}`}>
                      {chg != null ? `${isPos ? '+' : ''}${chg.toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right text-gray-500 tabular-nums">
                      {q?.market_cap != null
                        ? q.market_cap >= 1e12
                          ? `${sym}${(q.market_cap / 1e12).toFixed(1)}T`
                          : q.market_cap >= 1e9
                          ? `${sym}${(q.market_cap / 1e9).toFixed(1)}B`
                          : `${sym}${(q.market_cap / 1e6).toFixed(0)}M`
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right text-gray-500 tabular-nums">
                      {q?.pe != null ? `${q.pe.toFixed(1)}x` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleAnalyze(ticker)}
                          disabled={loading[ticker]}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700
                                     hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                          {loading[ticker] ? '...' : 'Analyze'}
                        </button>
                        <button
                          onClick={() => removeTicker(ticker)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
