import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysisDispatch } from '../context/AnalysisContext'
import { analyzeCompany, uploadFinancials } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'

const STEPS = [
  { id: 'company', label: 'COMPANY RESEARCH', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )},
  { id: 'industry', label: 'INDUSTRY RESEARCH', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  )},
  { id: 'synthesize', label: 'SYNTHESIZING REPORT', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )},
  { id: 'fact', label: 'FACT-CHECKING', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )},
]

const FEATURES = [
  {
    badge: 'MODEL 2.4',
    badgeColor: 'bg-blue-50 text-blue-700',
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    ),
    iconBg: 'bg-blue-50',
    title: 'DCF Valuation',
    desc: 'Unbiased multi-stage cash flow projections with sensitivity analysis across WACC and Terminal Growth.',
    link: 'CONFIGURE MODEL',
    to: '/valuation',
  },
  {
    badge: 'LIVE PEERS',
    badgeColor: 'bg-emerald-50 text-emerald-700',
    icon: (
      <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    iconBg: 'bg-emerald-50',
    title: 'Relative Valuation',
    desc: 'Automated peer group selection with real-time EV/EBITDA, P/E, and Revenue multiple comparisons.',
    link: 'VIEW COMPS',
    to: '/valuation',
  },
  {
    badge: 'ANALYST GRADE',
    badgeColor: 'bg-orange-50 text-orange-700',
    icon: (
      <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    iconBg: 'bg-orange-50',
    title: 'AI Research Report',
    desc: 'Comprehensive synthesis of transcripts, filings, and news into a structured 15-page equity research primer.',
    link: 'BROWSE LIBRARY',
    to: '/report',
  },
]

export default function HomePage() {
  const [ticker, setTicker] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState('')
  const dispatch = useAnalysisDispatch()
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const handleAnalyze = async () => {
    if (!ticker.trim()) return setError('Enter a ticker symbol or company name')
    setError('')
    setLoading(true)
    setLoadingStep(0)
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      setLoadingStep(1)
      const data = await analyzeCompany(ticker.trim().toUpperCase())
      setLoadingStep(2)
      dispatch({ type: 'SET_ANALYSIS', payload: data })
      dispatch({ type: 'SET_TICKER', payload: ticker.trim().toUpperCase() })
      setLoadingStep(3)
      navigate('/financials')
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Failed to fetch data'
      setError(msg)
      dispatch({ type: 'SET_ERROR', payload: msg })
    } finally {
      setLoading(false)
      setLoadingStep(0)
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

  const onFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    e.target.value = ''
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-white">
      {/* Hero section */}
      <div className="relative max-w-3xl mx-auto px-4 pt-16 pb-12 text-center">
        {/* Institutional tier badge */}
        <div className="absolute top-6 right-4 sm:right-0">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wider
                           border border-emerald-400 text-emerald-600 bg-emerald-50 uppercase">
            Institutional Tier
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-4 leading-tight">
          The Intelligent<br />Research Terminal
        </h1>
        <p className="text-lg text-gray-500 mb-10">
          Automate institutional-grade financial analysis and fundamental research in seconds.
        </p>

        {/* Unified search + upload bar */}
        <div className="relative flex items-center bg-white border-2 border-gray-200 rounded-xl shadow-sm
                        hover:border-gray-300 focus-within:border-blue-400 focus-within:ring-4
                        focus-within:ring-blue-50 transition-all mb-4">
          <svg className="absolute left-4 w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            placeholder="Enter Ticker (e.g. AAPL) or Company Name"
            className="flex-1 pl-12 pr-4 py-4 bg-transparent outline-none text-gray-900 placeholder-gray-400
                       text-base rounded-l-xl"
            disabled={loading}
          />
          <div className="border-l border-gray-200 px-1 py-1 pr-1.5 flex-shrink-0">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-50 hover:bg-gray-100
                         text-sm font-medium text-gray-600 transition-colors border border-gray-200 whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload 10-K
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />
        </div>

        {/* CTA button */}
        <button
          onClick={handleAnalyze}
          disabled={loading || !ticker.trim()}
          className="btn-primer shadow-lg shadow-blue-900/20 hover:shadow-blue-900/30"
        >
          {loading ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analyzing...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
              </svg>
              Generate Business Primer
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-left">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Progress steps */}
        <div className="flex items-center justify-center gap-2 mt-10">
          {STEPS.map((step, i) => {
            const done = loadingStep > i
            const active = loadingStep === i + 1
            return (
              <div key={step.id} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    done
                      ? 'bg-blue-600 text-white'
                      : active
                      ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-300 ring-offset-1'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {done ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : step.icon}
                  </div>
                  <span className={`text-[10px] font-bold tracking-wider whitespace-nowrap ${
                    done || active ? 'text-blue-700' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px w-10 mb-5 transition-colors ${done ? 'bg-blue-400' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* Feature cards */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 ${f.iconBg} rounded-xl flex items-center justify-center`}>
                  {f.icon}
                </div>
                <span className={`text-[10px] font-bold tracking-widest px-2 py-1 rounded ${f.badgeColor}`}>
                  {f.badge}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-5">{f.desc}</p>
              <button
                onClick={() => navigate(f.to)}
                className="flex items-center gap-1.5 text-xs font-bold tracking-widest text-[#1B3A8A] hover:text-blue-700 transition-colors"
              >
                {f.link}
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-5 text-xs text-gray-400 font-medium">
            <span className="font-bold text-[#1B3A8A]">Equity Intel Pro</span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
              Claude CLI Integrated
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              FINRA Compliant Templates
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <a href="#" className="hover:text-gray-600 transition-colors">Term of Service</a>
            <a href="#" className="hover:text-gray-600 transition-colors">Data Privacy</a>
            <a href="#" className="hover:text-gray-600 transition-colors">Institutional API</a>
          </div>
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50">
          <LoadingSpinner message={`Analyzing ${ticker}...`} />
        </div>
      )}
    </div>
  )
}
