import { useMemo } from 'react'

function getColor(price, currentPrice) {
  if (!price || !currentPrice) return 'bg-gray-100 text-gray-500'
  const upside = (price / currentPrice) - 1
  if (upside > 0.3) return 'bg-emerald-600 text-white font-semibold'
  if (upside > 0.15) return 'bg-emerald-400 text-white'
  if (upside > 0.05) return 'bg-emerald-200 text-emerald-900'
  if (upside > -0.05) return 'bg-yellow-100 text-yellow-800'
  if (upside > -0.15) return 'bg-red-200 text-red-900'
  if (upside > -0.30) return 'bg-red-400 text-white'
  return 'bg-red-600 text-white font-semibold'
}

export default function SensitivityHeatmap({ sensitivity, currentPrice }) {
  if (!sensitivity || !sensitivity.matrix?.length) {
    return <p className="text-gray-400 text-sm">No sensitivity data available</p>
  }

  const { wacc_values, tgr_values, matrix } = sensitivity

  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
        <span className="font-medium">WACC ↓ / Terminal Growth Rate →</span>
        <div className="flex items-center gap-2 ml-auto">
          <span className="w-3 h-3 rounded bg-red-500 inline-block" /> <span>Below current</span>
          <span className="w-3 h-3 rounded bg-yellow-200 inline-block ml-2" /> <span>~Fair value</span>
          <span className="w-3 h-3 rounded bg-emerald-500 inline-block ml-2" /> <span>Upside</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="text-left px-2 py-1 text-gray-600 font-medium">WACC</th>
              {tgr_values.map((tgr) => (
                <th key={tgr} className="px-2 py-1 text-gray-600 font-medium text-center">
                  {(tgr * 100).toFixed(1)}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.wacc}>
                <td className="px-2 py-1 font-medium text-gray-700">
                  {(row.wacc * 100).toFixed(1)}%
                </td>
                {row.values.map((price, i) => (
                  <td
                    key={i}
                    className={`px-2 py-1.5 rounded text-center tabular-nums ${getColor(price, currentPrice)}`}
                  >
                    {price != null ? `$${price.toFixed(0)}` : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {currentPrice > 0 && (
        <p className="text-xs text-gray-400 mt-2">Current price: ${currentPrice.toFixed(2)}</p>
      )}
    </div>
  )
}
