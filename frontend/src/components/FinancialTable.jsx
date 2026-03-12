import { useMemo } from 'react'

const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥' }

function fmt(val, currency, unit) {
  if (val === null || val === undefined) return '—'
  const n = Number(val)
  if (isNaN(n)) return String(val)
  const sym = CURRENCY_SYMBOLS[currency] || ''

  if (unit === 'Cr') {
    const abs = Math.abs(n)
    if (abs >= 100000) return `${sym}${(n / 100000).toFixed(1)}L`
    if (abs >= 1) return n.toLocaleString('en-IN', { maximumFractionDigits: 1 })
    return n.toFixed(1)
  }

  const abs = Math.abs(n)
  if (abs >= 1e12) return `${(n / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toFixed(1)
}

// Rows that get bold treatment + left accent bar + YoY sub-row
const MAJOR_FIELDS = new Set([
  'Revenue', 'Net Revenue', 'Total Revenue', 'Sales', 'Net Sales',
  'Gross Profit',
  'EBITDA',
  'Operating Income', 'EBIT', 'Operating Profit',
  'Net Income', 'Profit After Tax', 'PAT', 'Net Profit',
  'Total Assets', 'Total Current Assets',
  'Total Liabilities', 'Total Current Liabilities',
  'Total Equity', 'Shareholders Equity', 'Net Worth',
  'Operating Cash Flow', 'Investing Cash Flow', 'Financing Cash Flow',
  'Free Cash Flow', 'Net Cash Flow',
])

// Rows that also get a "% of Revenue" margin sub-row
const MARGIN_FIELDS = new Set([
  'Gross Profit',
  'EBITDA',
  'Operating Income', 'EBIT', 'Operating Profit',
  'Net Income', 'Profit After Tax', 'PAT', 'Net Profit',
])

function getRevenue(periodData) {
  if (!periodData) return null
  return (
    periodData['Revenue'] ??
    periodData['Net Revenue'] ??
    periodData['Total Revenue'] ??
    periodData['Sales'] ??
    null
  )
}

function fmtYoY(v) {
  if (v == null) return '—'
  const s = (v * 100).toFixed(1)
  return v >= 0 ? `+${s}%` : `${s}%`
}

function fmtPeriod(p) {
  if (!p || p === 'null' || p === 'undefined') return p
  if (/^\d{4}$/.test(p)) return p
  if (p.toUpperCase() === 'TTM') return 'TTM'
  const m = p.match(/\b(19|20)\d{2}\b/)
  if (m) return m[0]
  try {
    const d = new Date(p)
    if (!isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100)
      return d.getFullYear().toString()
  } catch { /* ignore */ }
  return p
}

export default function FinancialTable({ data, currency = 'USD', unit = null, viewMode = 'research' }) {
  const t = viewMode === 'terminal'

  const periods = useMemo(() => Object.keys(data || {}).sort(), [data])

  const rows = useMemo(() => {
    if (!data || periods.length === 0) return []
    const latestPeriod = data[periods[periods.length - 1]] || {}
    const lineItems = Object.keys(latestPeriod)
    const result = []

    for (const item of lineItems) {
      const isMajor = MAJOR_FIELDS.has(item)
      const isMarginField = MARGIN_FIELDS.has(item)
      const values = periods.map(p => data[p]?.[item] ?? null)

      result.push({ type: 'main', item, isMajor, values })

      // YoY growth sub-row
      if (isMajor) {
        const yv = periods.map((p, i) => {
          if (i === 0) return null
          const curr = data[p]?.[item]
          const prev = data[periods[i - 1]]?.[item]
          if (curr == null || prev == null || prev === 0) return null
          return (curr - prev) / Math.abs(prev)
        })
        if (yv.some(v => v != null)) {
          result.push({ type: 'yoy', item, values: yv })
        }
      }

      // Margin % sub-row
      if (isMarginField) {
        const mv = periods.map(p => {
          const val = data[p]?.[item]
          const rev = getRevenue(data[p])
          if (val == null || !rev || rev === 0) return null
          return val / rev
        })
        if (mv.some(v => v != null)) {
          result.push({ type: 'margin', item, values: mv })
        }
      }
    }
    return result
  }, [data, periods])

  if (!data || Object.keys(data).length === 0) {
    return (
      <p className={`text-sm p-4 ${t ? 'text-slate-500' : 'text-gray-400'}`}>
        No data available
      </p>
    )
  }

  const accentBorder = t ? 'border-l-amber-400' : 'border-l-[#0a1628]'
  const rowBorder = t ? 'border-b border-[#1e3048]' : 'border-b border-gray-100'
  const rowHover = t ? 'hover:bg-[#162032]' : 'hover:bg-gray-50'
  const headerColor = t ? 'text-amber-400' : 'text-[#0a1628]'

  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-xs ${t ? 'font-mono' : ''}`}>
        <thead>
          <tr className={t ? 'border-b border-amber-400/40' : 'border-b-2 border-[#0a1628]'}>
            <th className={`sticky left-0 text-left py-2.5 pl-3 pr-6 w-52 font-bold tracking-wider ${headerColor} ${t ? 'bg-[#0f1f30]' : 'bg-white'}`}>
              {unit === 'Cr' ? '₹ CRORE' : 'METRIC'}
            </th>
            {periods.map(p => (
              <th key={p} className={`text-right py-2.5 px-3 font-bold tracking-wider whitespace-nowrap ${headerColor}`}>
                {fmtPeriod(p)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            if (row.type === 'main') {
              const boldLabel = row.isMajor
                ? (t ? 'font-bold text-white' : 'font-bold text-[#0a1628]')
                : (t ? 'text-slate-300' : 'text-gray-600')
              const boldNum = row.isMajor
                ? (t ? 'font-bold text-white' : 'font-bold text-gray-900')
                : (t ? 'text-slate-300' : 'text-gray-600')
              return (
                <tr
                  key={`${row.item}_main`}
                  className={`${rowBorder} ${rowHover} border-l-4 ${row.isMajor ? accentBorder : 'border-l-transparent'}`}
                >
                  <td className={`sticky left-0 py-2 pl-2 pr-6 ${boldLabel} ${t ? 'bg-[#0f1f30]' : 'bg-white'} ${rowHover}`}>
                    {row.item}
                  </td>
                  {row.values.map((v, i) => (
                    <td key={periods[i]} className={`text-right py-2 px-3 tabular-nums whitespace-nowrap ${boldNum}`}>
                      {fmt(v, currency, unit)}
                    </td>
                  ))}
                </tr>
              )
            }

            if (row.type === 'yoy') {
              return (
                <tr
                  key={`${row.item}_yoy`}
                  className={`${t ? 'border-b border-[#1e3048]/50' : 'border-b border-gray-50'} border-l-4 border-l-transparent`}
                >
                  <td className={`sticky left-0 py-0.5 pl-6 pr-6 italic ${t ? 'text-slate-500 bg-[#0f1f30]' : 'text-gray-400 bg-white'}`}>
                    YoY Growth
                  </td>
                  {row.values.map((v, i) => (
                    <td
                      key={periods[i]}
                      className={`text-right py-0.5 px-3 tabular-nums font-medium ${
                        v == null
                          ? (t ? 'text-slate-700' : 'text-gray-300')
                          : v >= 0
                          ? (t ? 'text-green-400' : 'text-green-700')
                          : (t ? 'text-red-400' : 'text-red-600')
                      }`}
                    >
                      {fmtYoY(v)}
                    </td>
                  ))}
                </tr>
              )
            }

            if (row.type === 'margin') {
              return (
                <tr
                  key={`${row.item}_margin`}
                  className={`${t ? 'border-b border-[#1e3048]/50' : 'border-b border-gray-50'} border-l-4 border-l-transparent`}
                >
                  <td className={`sticky left-0 py-0.5 pl-6 pr-6 italic ${t ? 'text-slate-500 bg-[#0f1f30]' : 'text-gray-400 bg-white'}`}>
                    % of Revenue
                  </td>
                  {row.values.map((v, i) => (
                    <td key={periods[i]} className={`text-right py-0.5 px-3 tabular-nums italic ${t ? 'text-slate-400' : 'text-gray-400'}`}>
                      {v != null ? `${(v * 100).toFixed(1)}%` : '—'}
                    </td>
                  ))}
                </tr>
              )
            }

            return null
          })}
        </tbody>
      </table>
    </div>
  )
}
