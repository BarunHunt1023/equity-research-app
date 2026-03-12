const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥' }

const fmt = (val, currency, unit) => {
  if (val === null || val === undefined) return '—'
  const n = Number(val)
  if (isNaN(n)) return String(val)
  const sym = CURRENCY_SYMBOLS[currency] || ''

  if (unit === 'Cr') {
    const abs = Math.abs(n)
    if (abs >= 100000) return `${sym}${(n / 100000).toFixed(1)}L Cr`
    if (abs >= 1) return `${n.toLocaleString('en-IN', { maximumFractionDigits: 1 })}`
    return n.toFixed(1)
  }

  const abs = Math.abs(n)
  if (abs >= 1e12) return `${(n / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toFixed(1)
}

export default function FinancialTable({ data, title, currency, unit }) {
  if (!data || Object.keys(data).length === 0) {
    return <p className="text-gray-400 text-sm">No data available</p>
  }

  // data is { date: { lineItem: value } }
  const periods = Object.keys(data).sort()
  const firstPeriod = data[periods[periods.length - 1]] || {}
  const lineItems = Object.keys(firstPeriod)

  // Format period headers - extract year robustly
  const formatPeriod = (p) => {
    if (!p || p === 'null' || p === 'undefined') return p

    // Already a clean 4-digit year
    if (/^\d{4}$/.test(p)) return p

    // "TTM" or similar labels
    if (p.toUpperCase() === 'TTM') return 'TTM'

    // Try to extract a 4-digit year from the string
    const yearMatch = p.match(/\b(19|20)\d{2}\b/)
    if (yearMatch) return yearMatch[0]

    // Try Date parsing as last resort
    try {
      const d = new Date(p)
      if (!isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100) {
        return d.getFullYear().toString()
      }
    } catch { /* ignore */ }

    return p
  }

  return (
    <div>
      {title && <h3 className="section-title">{title}</h3>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 pr-4 text-gray-600 font-medium w-1/3">Item</th>
              {periods.map((p) => (
                <th key={p} className="text-right py-2 px-3 text-gray-600 font-medium">
                  {formatPeriod(p)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item) => (
              <tr key={item} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-1.5 pr-4 text-gray-700 font-medium text-xs">
                  {item.replace(/([A-Z])/g, ' $1').trim()}
                </td>
                {periods.map((p) => (
                  <td key={p} className="text-right py-1.5 px-3 tabular-nums text-gray-600 text-xs">
                    {fmt(data[p]?.[item], currency, unit)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
