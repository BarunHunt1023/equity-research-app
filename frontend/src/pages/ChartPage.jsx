import { useNavigate } from 'react-router-dom'
import { useAnalysis } from '../context/AnalysisContext'
import TradingChart from '../components/charts/TradingChart'
import AppSidebar from '../components/AppSidebar'

const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥' }

export default function ChartPage() {
  const { companyInfo, historicalPrices, dcf } = useAnalysis()
  const navigate = useNavigate()

  const impliedPrice = dcf?.implied_share_price ?? 0
  const sym = CURRENCY_SYMBOLS[companyInfo?.currency] || '$'

  if (!companyInfo && !historicalPrices?.length) {
    return (
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 flex bg-gray-50 min-h-[calc(100vh-3.5rem)]">
        <AppSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <p className="text-gray-500 mb-4">No chart data loaded. Analyze a company first.</p>
            <button onClick={() => navigate('/')} className="btn-primary">Analyze a Company</button>
          </div>
        </div>
      </div>
    )
  }

  const price = companyInfo?.current_price
  const pctChange = companyInfo?.fifty_two_week_high && price
    ? null
    : null

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 flex bg-[#F8FAFC] min-h-[calc(100vh-3.5rem)]">
      <AppSidebar />

      <div className="flex-1 min-w-0 overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              <span className="text-blue-600">Equity Analysis</span>
              <span>/</span>
              <span>Trading Chart</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">
                {companyInfo?.name || 'Chart'}{' '}
                {companyInfo?.ticker && (
                  <span className="text-gray-400 font-normal">({companyInfo.ticker})</span>
                )}
              </h1>
              {price != null && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-gray-900 tabular-nums">
                    {sym}{price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
            {/* Key stats row */}
            {companyInfo && (
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-500">
                {companyInfo.sector && <span>{companyInfo.sector}</span>}
                {companyInfo.market_cap && (
                  <span>Mkt Cap: <span className="font-semibold text-gray-700">
                    {sym}{(companyInfo.market_cap / 1e9).toFixed(1)}B
                  </span></span>
                )}
                {companyInfo.trailing_pe && (
                  <span>P/E: <span className="font-semibold text-gray-700">{companyInfo.trailing_pe.toFixed(1)}x</span></span>
                )}
                {companyInfo.beta && (
                  <span>Beta: <span className="font-semibold text-gray-700">{companyInfo.beta.toFixed(2)}</span></span>
                )}
                {companyInfo.fifty_two_week_high && (
                  <span>52W H: <span className="font-semibold text-gray-700">{sym}{companyInfo.fifty_two_week_high.toFixed(2)}</span></span>
                )}
                {companyInfo.fifty_two_week_low && (
                  <span>52W L: <span className="font-semibold text-gray-700">{sym}{companyInfo.fifty_two_week_low.toFixed(2)}</span></span>
                )}
                {impliedPrice > 0 && (
                  <span className="text-emerald-600 font-semibold">
                    Intrinsic: {sym}{impliedPrice.toFixed(2)}
                    {price > 0 && (
                      <span className={`ml-1 ${impliedPrice > price ? 'text-emerald-600' : 'text-red-500'}`}>
                        ({impliedPrice > price ? '+' : ''}{(((impliedPrice - price) / price) * 100).toFixed(1)}% upside)
                      </span>
                    )}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate('/financials')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border
                         border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Financials
            </button>
            <button
              onClick={() => navigate('/valuation')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg
                         bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Run Valuation
            </button>
          </div>
        </div>

        {/* Main chart card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <TradingChart
            priceHistory={historicalPrices}
            impliedPrice={impliedPrice}
            ticker={companyInfo?.ticker}
          />
        </div>

        {/* Analyst target + description */}
        {(companyInfo?.target_mean_price || companyInfo?.description) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {companyInfo.target_mean_price && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                  Analyst Price Targets
                </h3>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-center">
                    <div className="text-lg font-bold text-red-500">
                      {sym}{companyInfo.target_low_price?.toFixed(2) ?? '—'}
                    </div>
                    <div className="text-[10px] text-gray-400">Low</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {sym}{companyInfo.target_mean_price?.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Mean · {companyInfo.number_of_analyst_opinions ?? 0} analysts
                    </div>
                    <div className="text-xs font-semibold capitalize text-emerald-600 mt-0.5">
                      {companyInfo.recommendation_key?.replace('_', ' ')}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-emerald-600">
                      {sym}{companyInfo.target_high_price?.toFixed(2) ?? '—'}
                    </div>
                    <div className="text-[10px] text-gray-400">High</div>
                  </div>
                </div>
                {/* Target range bar */}
                {price && companyInfo.target_low_price && companyInfo.target_high_price && (
                  <div className="relative h-2 bg-gray-100 rounded-full">
                    <div
                      className="absolute h-full bg-blue-200 rounded-full"
                      style={{
                        left: `${Math.max(0, ((companyInfo.target_low_price - companyInfo.target_low_price * 0.9) / (companyInfo.target_high_price * 1.1 - companyInfo.target_low_price * 0.9)) * 100)}%`,
                        width: `${Math.min(100, ((companyInfo.target_high_price - companyInfo.target_low_price) / (companyInfo.target_high_price * 1.1 - companyInfo.target_low_price * 0.9)) * 100)}%`
                      }}
                    />
                    <div
                      className="absolute w-3 h-3 bg-blue-600 rounded-full -top-0.5"
                      style={{
                        left: `${Math.min(97, Math.max(0, ((price - companyInfo.target_low_price * 0.9) / (companyInfo.target_high_price * 1.1 - companyInfo.target_low_price * 0.9)) * 100))}%`
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {companyInfo.description && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                  Business Overview
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed line-clamp-5">
                  {companyInfo.description}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
