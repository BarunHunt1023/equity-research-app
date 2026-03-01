const fmt = (val) => {
  if (val === null || val === undefined) return '—'
  const n = Number(val)
  if (isNaN(n)) return String(val)
  const abs = Math.abs(n)
  if (abs >= 1e12) return `${(n / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toFixed(1)
}

export default function FinancialTable({ data, title }) {
  if (!data || Object.keys(data).length === 0) {
    return <p className="text-gray-400 text-sm">No data available</p>
  }

  // data is { date: { lineItem: value } }
  const periods = Object.keys(data).sort().reverse()
  const firstPeriod = data[periods[0]] || {}
  const lineItems = Object.keys(firstPeriod)

  // Format period headers (extract year from ISO date)
  const formatPeriod = (p) => {
    try {
      return new Date(p).getFullYear().toString()
    } catch {
      return p
    }
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
                    {fmt(data[p]?.[item])}
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
