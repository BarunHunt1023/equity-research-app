import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import FinancialsPage from './pages/FinancialsPage'
import ForecastPage from './pages/ForecastPage'
import ValuationPage from './pages/ValuationPage'
import ReportPage from './pages/ReportPage'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/financials" element={<FinancialsPage />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/valuation" element={<ValuationPage />} />
          <Route path="/report" element={<ReportPage />} />
        </Routes>
      </main>
    </div>
  )
}
