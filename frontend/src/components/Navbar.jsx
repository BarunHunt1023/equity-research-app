import { NavLink, useNavigate } from 'react-router-dom'
import { useAnalysis } from '../context/AnalysisContext'
import { useState } from 'react'

const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥' }

const links = [
  { to: '/', label: 'Home', exact: true },
  { to: '/financials', label: 'Financials' },
  { to: '/chart', label: 'Chart' },
  { to: '/screener', label: 'Screener' },
  { to: '/watchlist', label: 'Watchlist' },
  { to: '/forecast', label: 'Forecast' },
  { to: '/valuation', label: 'Valuation' },
  { to: '/report', label: 'Report' },
]

export default function Navbar() {
  const { companyInfo } = useAnalysis()
  const sym = CURRENCY_SYMBOLS[companyInfo?.currency] || '$'
  const [searchVal, setSearchVal] = useState('')
  const navigate = useNavigate()

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchVal.trim()) {
      navigate('/')
    }
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <NavLink to="/" className="flex items-center gap-2 flex-shrink-0">
              <span className="font-bold text-lg text-[#1B3A8A] tracking-tight">
                Equity Research Pro
              </span>
            </NavLink>

            {/* Nav links */}
            <div className="hidden md:flex items-center gap-1">
              {links.map(({ to, label, exact }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={exact}
                  className={({ isActive }) =>
                    `px-3 py-4 text-sm font-medium border-b-2 transition-colors ${
                      isActive
                        ? 'border-[#2563EB] text-[#1B3A8A]'
                        : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </div>
          </div>

          {/* Right: search + icons */}
          <div className="flex items-center gap-3">
            {/* Search bar */}
            <div className="relative hidden sm:flex items-center">
              <svg className="absolute left-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value.toUpperCase())}
                onKeyDown={handleSearch}
                placeholder="Search ticker or company..."
                className="pl-9 pr-4 py-1.5 text-sm rounded-full border border-gray-200 bg-gray-50
                           focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-100
                           outline-none transition-all w-52 focus:w-64"
              />
            </div>

            {/* Bell */}
            <button className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>

            {/* User avatar */}
            <div className="w-8 h-8 rounded-full bg-[#1B3A8A] flex items-center justify-center cursor-pointer">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
              </svg>
            </div>

            {/* Live ticker badge */}
            {companyInfo && (
              <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-gray-200 ml-1">
                <span className="text-xs font-mono font-semibold text-gray-900">{companyInfo.ticker}</span>
                {companyInfo.current_price != null && (
                  <span className="text-xs text-gray-500">
                    {sym}{companyInfo.current_price?.toFixed(2)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
