import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import FinancialsPage from './pages/FinancialsPage'
import ForecastPage from './pages/ForecastPage'
import ValuationPage from './pages/ValuationPage'
import OnePagerPage from './pages/OnePagerPage'
import ReportPage from './pages/ReportPage'

export default function App() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Navbar />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-x-hidden">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/financials" element={<FinancialsPage />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/valuation" element={<ValuationPage />} />
          <Route path="/one-pager" element={<OnePagerPage />} />
          <Route path="/report" element={<ReportPage />} />
        </Routes>
      </main>
    </div>
  )
}
