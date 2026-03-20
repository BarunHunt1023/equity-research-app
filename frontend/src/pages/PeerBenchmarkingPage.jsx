import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from 'recharts'

/* ─── Static Data ─── */
const COMPANY = { name: 'Global Tech Corp', ticker: 'GTC', sector: 'SaaS & Cloud Infrastructure' }

const KPI_CARDS = [
  {
    label: 'PRICE / EARNINGS (FY1)',
    value: '28.4x',
    delta: '+12.4%',
    positive: true,
    sub: 'VS SECTOR AVG (25.3X)',
    border: 'border-l-4 border-blue-600',
  },
  {
    label: 'EV / EBITDA',
    value: '18.2x',
    delta: '-4.1%',
    positive: false,
    sub: 'VS SECTOR AVG (19.0X)',
    border: 'border-l-4 border-blue-600',
  },
  {
    label: 'NET MARGIN (%)',
    value: '24.8%',
    delta: '+620bps',
    positive: true,
    sub: 'VS SECTOR AVG (18.6%)',
    border: 'border-l-4 border-green-500',
  },
]

const RADAR_DATA = [
  { metric: 'REVENUE\nGROWTH', subject: 'Revenue Growth', GTC: 82, PEER: 60 },
  { metric: 'EBITDA\nMARGIN', subject: 'EBITDA Margin', GTC: 70, PEER: 55 },
  { metric: 'ROE', subject: 'ROE', GTC: 55, PEER: 50 },
  { metric: 'P/E\nRATIO', subject: 'P/E Ratio', GTC: 65, PEER: 72 },
  { metric: 'P/S\nRATIO', subject: 'P/S Ratio', GTC: 60, PEER: 68 },
]

const MARKET_CAP = [
  { name: 'Global Tech Corp (GTC)', value: 1240.5, highlight: true },
  { name: 'CloudScale Inc', value: 985.2, highlight: false },
  { name: 'DataNexus Sys', value: 742.8, highlight: false },
  { name: 'Apex Infrastructure', value: 425.1, highlight: false },
  { name: 'SkyFlow Tech', value: 210.4, highlight: false },
]

const TABLE_ROWS = [
  { company: 'Global Tech Corp', ticker: 'GTC', mktCap: 1240.5, pe: '28.4x', ev: '18.2x', ps: '6.4x', netMargin: '24.8%', perf: '+14.2%', highlight: true },
  { company: 'CloudScale Inc', ticker: 'CSCL', mktCap: 985.2, pe: '32.1x', ev: '21.4x', ps: '8.1x', netMargin: '19.2%', perf: '+22.5%', highlight: false },
  { company: 'DataNexus Sys', ticker: 'DNEX', mktCap: 742.8, pe: '24.5x', ev: '16.8x', ps: '5.2x', netMargin: '17.5%', perf: '-2.1%', highlight: false },
  { company: 'Apex Infrastructure', ticker: 'APEX', mktCap: 425.1, pe: '21.8x', ev: '14.2x', ps: '4.1x', netMargin: '14.3%', perf: '+8.7%', highlight: false },
  { company: 'SkyFlow Tech', ticker: 'SKYW', mktCap: 210.4, pe: '44.2x', ev: '28.5x', ps: '12.2x', netMargin: '8.4%', perf: '+42.1%', highlight: false },
]

const SECTOR_AVG = { mktCap: 720.8, pe: '25.3x', ev: '19.0x', ps: '7.2x', netMargin: '18.6%', perf: '+17.1%' }

/* ─── Sidebar ─── */
const SIDEBAR_NAV = [
  {
    label: 'DASHBOARD', to: '/',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
      </svg>
    ),
  },
  {
    label: 'SECTOR ANALYSIS', to: '/financials',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
  {
    label: 'PEER BENCHMARKING', to: '/peer-benchmarking', active: true,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
  {
    label: 'FINANCIAL MODELING', to: '/forecast',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'VALUATION', to: '/valuation',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'RISK METRICS', to: '/one-pager',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
]

function Sidebar() {
  return (
    <aside className="w-52 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      {/* Branding */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800
                          flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            GR
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-900 tracking-wide uppercase">Global Research</p>
            <p className="text-[9px] font-semibold tracking-widest text-gray-400 uppercase">Institutional Tier</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto">
        {SIDEBAR_NAV.map(({ label, to, icon, active }) => (
          <NavLink
            key={label}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              (isActive || active)
                ? 'flex items-center gap-2.5 px-4 py-2 text-[11px] font-bold tracking-wider text-blue-700 bg-blue-50 border-l-2 border-blue-600 cursor-pointer'
                : 'flex items-center gap-2.5 px-4 py-2 text-[11px] font-semibold tracking-wider text-gray-500 hover:bg-gray-50 hover:text-gray-700 border-l-2 border-transparent cursor-pointer'
            }
          >
            {icon}
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="p-3 border-t border-gray-100 space-y-1">
        <button className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg
                           bg-[#1B3A8A] text-white text-[11px] font-bold tracking-wider
                           hover:bg-[#152e70] transition-colors uppercase">
          Create Report
        </button>
        <NavLink to="/" className="flex items-center gap-2.5 px-2 py-1.5 text-[11px] font-semibold tracking-wider text-gray-400 hover:text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Help Center
        </NavLink>
        <NavLink to="/" className="flex items-center gap-2.5 px-2 py-1.5 text-[11px] font-semibold tracking-wider text-gray-400 hover:text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          API Docs
        </NavLink>
      </div>
    </aside>
  )
}

/* ─── Radar chart label ─── */
function CustomAngleLabel({ x, y, cx, cy, payload }) {
  const lines = payload.value.split('\n')
  return (
    <text x={x} y={y} textAnchor="middle" fill="#94a3b8" fontSize={9} fontWeight={600} letterSpacing={0.5}>
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? (y < cy ? -4 : 4) : 11}>{line}</tspan>
      ))}
    </text>
  )
}

/* ─── Market Cap Bar ─── */
function MarketCapBar({ name, value, highlight }) {
  const max = 1240.5
  const pct = (value / max) * 100
  return (
    <div className="mb-4">
      <div className="flex justify-between items-baseline mb-1">
        <span className={`text-xs font-medium ${highlight ? 'text-gray-900 font-semibold' : 'text-gray-600'}`}>{name}</span>
        <span className={`text-xs font-bold tabular-nums ${highlight ? 'text-blue-600' : 'text-gray-700'}`}>{value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${highlight ? 'bg-blue-600' : 'bg-gray-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/* ─── Main Page ─── */
export default function PeerBenchmarkingPage() {
  const [tableTab, setTableTab] = useState('Q3_2023')

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 flex bg-[#F8FAFC] min-h-[calc(100vh-3.5rem)]">
      <Sidebar />

      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1100px]">

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-gray-800 text-white uppercase">
                Ticker: {COMPANY.ticker}
              </span>
              <span className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">Equity Research Terminal</span>
            </div>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-1">Sector Peer Benchmarking</h1>
                <p className="text-sm text-gray-500">
                  Comparative analysis of{' '}
                  <a href="#" className="text-blue-600 font-semibold hover:underline">
                    {COMPANY.name} ({COMPANY.ticker})
                  </a>{' '}
                  against high-growth peers in the{' '}
                  <a href="#" className="text-blue-600 font-semibold hover:underline">{COMPANY.sector}</a>
                  {' '}sector.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                  </svg>
                  Filter
                </button>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export
                </button>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {KPI_CARDS.map((card) => (
              <div key={card.label} className={`bg-white rounded-xl border border-gray-200 p-5 ${card.border}`}>
                <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-3">{card.label}</p>
                <div className="flex items-end justify-between">
                  <span className="text-4xl font-bold text-gray-900 tabular-nums">{card.value}</span>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${card.positive ? 'text-emerald-500' : 'text-red-500'}`}>
                      {card.delta}
                    </div>
                    <div className="text-[10px] text-gray-400 font-medium mt-0.5">{card.sub}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            {/* Radar / Competitive Efficiency */}
            <div className="col-span-3 bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-bold tracking-widest text-gray-600 uppercase">Competitive Efficiency Profile</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                    GTC
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" />
                    PEER AVG
                  </span>
                </div>
              </div>

              {/* Dark radar background */}
              <div className="rounded-xl overflow-hidden" style={{ background: '#1a3a3a' }}>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={RADAR_DATA} margin={{ top: 24, right: 40, bottom: 24, left: 40 }}>
                    <PolarGrid stroke="rgba(255,255,255,0.15)" />
                    <PolarAngleAxis
                      dataKey="metric"
                      tick={<CustomAngleLabel />}
                      tickLine={false}
                    />
                    <Radar
                      name="PEER AVG"
                      dataKey="PEER"
                      stroke="rgba(255,255,255,0.5)"
                      fill="rgba(255,255,255,0.08)"
                      strokeWidth={1.5}
                    />
                    <Radar
                      name="GTC"
                      dataKey="GTC"
                      stroke="#38bdf8"
                      fill="rgba(56,189,248,0.15)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#ffffff', strokeWidth: 1 }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Market Cap Comparison */}
            <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-[11px] font-bold tracking-widest text-gray-600 uppercase mb-5">Market Cap Comparison ($B)</p>
              {MARKET_CAP.map((item) => (
                <MarketCapBar key={item.name} {...item} />
              ))}
            </div>
          </div>

          {/* Detailed Benchmarking Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <span className="text-[11px] font-bold tracking-widest text-gray-600 uppercase">Detailed Benchmarking Table</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTableTab('Q3_2023')}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold tracking-wide transition-colors ${
                    tableTab === 'Q3_2023'
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  Q3 2023 REPORTED
                </button>
                <button
                  onClick={() => setTableTab('LTM')}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold tracking-wide transition-colors ${
                    tableTab === 'LTM'
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  LTM BASIS
                </button>
              </div>
            </div>

            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['COMPANY NAME', 'TICKER', 'MKT CAP ($B)', 'P/E (FY1)', 'EV/EBITDA', 'P/S', 'NET MARGIN', '1Y PERF'].map((col) => (
                    <th key={col} className="px-4 py-3 text-left text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TABLE_ROWS.map((row) => (
                  <tr key={row.ticker} className={`border-b border-gray-50 ${row.highlight ? 'bg-white' : 'hover:bg-gray-50/50'}`}>
                    <td className={`px-4 py-3.5 text-sm ${row.highlight ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {row.company}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-bold ${row.highlight ? 'text-blue-600' : 'text-gray-400'}`}>{row.ticker}</span>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-medium text-gray-700 tabular-nums">
                      {row.mktCap.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-700 tabular-nums">{row.pe}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-700 tabular-nums">{row.ev}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-700 tabular-nums">{row.ps}</td>
                    <td className={`px-4 py-3.5 text-sm font-semibold tabular-nums ${row.highlight ? 'text-emerald-600' : 'text-gray-700'}`}>
                      {row.netMargin}
                    </td>
                    <td className={`px-4 py-3.5 text-sm font-bold tabular-nums ${
                      row.perf.startsWith('-') ? 'text-red-500' : 'text-emerald-500'
                    }`}>
                      {row.perf}
                    </td>
                  </tr>
                ))}

                {/* Sector Average row */}
                <tr className="bg-gray-900">
                  <td className="px-4 py-3.5 text-xs font-bold tracking-wider text-white uppercase">Sector Average</td>
                  <td className="px-4 py-3.5 text-xs text-gray-400">—</td>
                  <td className="px-4 py-3.5 text-sm font-bold text-white tabular-nums">
                    {SECTOR_AVG.mktCap.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-bold text-white tabular-nums">{SECTOR_AVG.pe}</td>
                  <td className="px-4 py-3.5 text-sm font-bold text-white tabular-nums">{SECTOR_AVG.ev}</td>
                  <td className="px-4 py-3.5 text-sm font-bold text-white tabular-nums">{SECTOR_AVG.ps}</td>
                  <td className="px-4 py-3.5 text-sm font-bold text-white tabular-nums">{SECTOR_AVG.netMargin}</td>
                  <td className="px-4 py-3.5 text-sm font-bold text-emerald-400 tabular-nums">{SECTOR_AVG.perf}</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  )
}
