import { NavLink } from 'react-router-dom'
import { useAnalysis } from '../context/AnalysisContext'

const links = [
  { to: '/', label: 'Home' },
  { to: '/financials', label: 'Financials' },
  { to: '/forecast', label: 'Forecast' },
  { to: '/valuation', label: 'Valuation' },
  { to: '/report', label: 'Report' },
]

export default function Navbar() {
  const { companyInfo } = useAnalysis()

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">ER</span>
            </div>
            <span className="font-semibold text-lg text-gray-900">Equity Research Pro</span>
          </div>
          <div className="flex items-center gap-1">
            {links.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
          {companyInfo && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-900">
                {companyInfo.ticker}
              </span>
              <span className="text-sm text-gray-500">
                ${companyInfo.current_price?.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
