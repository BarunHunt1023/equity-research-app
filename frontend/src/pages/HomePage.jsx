import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysisDispatch } from '../context/AnalysisContext'
import { analyzeCompany, uploadFinancials } from '../api/client'
import FileUpload from '../components/FileUpload'
import LoadingSpinner from '../components/LoadingSpinner'

function MetricBadge({ label }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-medium">
      {label}
    </span>
  )
}

export default function HomePage() {
  const [ticker, setTicker] = useState('')
  const [mode, setMode] = useState('upload') // default to upload since yfinance is broken
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const dispatch = useAnalysisDispatch()
  const navigate = useNavigate()

  const handleAnalyze = async () => {
    if (!ticker.trim()) return setError('Please enter a ticker symbol')
    setError('')
    setLoading(true)
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const data = await analyzeCompany(ticker.trim().toUpperCase())
      dispatch({ type: 'SET_ANALYSIS', payload: data })
      dispatch({ type: 'SET_TICKER', payload: ticker.trim().toUpperCase() })
      navigate('/financials')
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Failed to fetch data'
      setError(msg)
      dispatch({ type: 'SET_ERROR', payload: msg })
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (file) => {
    setLoading(true)
    setError('')
    try {
      const data = await uploadFinancials(file, ticker.trim().toUpperCase() || undefined)
      dispatch({ type: 'SET_ANALYSIS', payload: data })
      dispatch({ type: 'SET_TICKER', payload: data.company_info?.ticker || ticker.trim().toUpperCase() || 'UPLOADED' })
      navigate('/financials')
    } catch (e) {
      const msg = e.response?.data?.detail || 'Failed to parse file'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
          <span className="text-white text-2xl font-bold">ER</span>
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          Equity Research Pro
        </h1>
        <p className="text-gray-500 text-lg">
          AI-powered equity research reports with DCF and relative valuation
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {['DCF Valuation', 'Relative Valuation', '3-Year Forecast', 'Peer Analysis', 'AI Report', 'Sensitivity Analysis'].map((l) => (
            <MetricBadge key={l} label={l} />
          ))}
        </div>
      </div>

      {/* Mode toggle */}
      <div className="card mb-6">
        <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
          {[['upload', 'Upload Financials (Excel/CSV)'], ['live', 'Live Yahoo Finance Data']].map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                mode === m ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'live' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stock Ticker Symbol
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                placeholder="e.g. AAPL, MSFT, TSLA"
                className="input-field text-lg font-mono"
                disabled={loading}
              />
              <button
                onClick={handleAnalyze}
                disabled={loading || !ticker.trim()}
                className="btn-primary whitespace-nowrap"
              >
                Analyze
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Fetches live data from Yahoo Finance including financials, price history, and peer companies
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stock Ticker / Company Name
            </label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="e.g. RELIANCE, TCS, INFY"
              className="input-field text-lg font-mono mb-4"
              disabled={loading}
            />
            <FileUpload onUpload={handleUpload} loading={loading} />
            <p className="text-xs text-gray-400 mt-3 text-center">
              Download financials from screener.in and upload the Excel/CSV file here
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}
      </div>

      {loading && (
        <LoadingSpinner message={
          mode === 'live'
            ? `Fetching data for ${ticker}...`
            : 'Parsing financials...'
        } />
      )}

      {/* Feature grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            icon: '📊',
            title: 'DCF Valuation',
            desc: 'WACC via CAPM, FCF projections, Gordon Growth & exit multiple terminal value, sensitivity matrix',
          },
          {
            icon: '🔍',
            title: 'Relative Valuation',
            desc: 'P/E, EV/EBITDA, P/B, P/S peer multiples with football field chart showing implied value range',
          },
          {
            icon: '🤖',
            title: 'AI Research Report',
            desc: 'Claude AI generates investment thesis, risk analysis, and industry overview — institutional quality',
          },
        ].map((f) => (
          <div key={f.title} className="card text-center">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
            <p className="text-sm text-gray-500">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
