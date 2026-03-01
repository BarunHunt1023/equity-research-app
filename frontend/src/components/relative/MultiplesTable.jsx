function fmt(v, decimals = 1) {
  if (v == null || isNaN(v)) return '—'
  return `${v.toFixed(decimals)}x`
}

function fmtB(v) {
  if (v == null) return '—'
  if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  return `$${v.toFixed(0)}`
}

function fmtPct(v) {
  if (v == null) return '—'
  return `${(v * 100).toFixed(1)}%`
}

const COLS = [
  { key: 'name', label: 'Company', align: 'left', render: (v) => v || '—' },
  { key: 'market_cap', label: 'Mkt Cap', align: 'right', render: fmtB },
  { key: 'trailing_pe', label: 'P/E', align: 'right', render: fmt },
  { key: 'price_to_book', label: 'P/B', align: 'right', render: fmt },
  { key: 'price_to_sales', label: 'P/S', align: 'right', render: fmt },
  { key: 'ev_to_ebitda', label: 'EV/EBITDA', align: 'right', render: fmt },
  { key: 'ev_to_revenue', label: 'EV/Rev', align: 'right', render: fmt },
  { key: 'profit_margin', label: 'Net Margin', align: 'right', render: fmtPct },
]

export default function MultiplesTable({ peers, targetTicker, targetMultiples, peerSummary }) {
  if (!peers?.length) {
    return <p className="text-gray-400 text-sm">No peer data loaded</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-200">
            {COLS.map((c) => (
              <th key={c.key} className={`py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Peer rows */}
          {peers.map((peer) => (
            <tr key={peer.ticker} className="border-b border-gray-50 hover:bg-gray-50">
              {COLS.map((c) => (
                <td key={c.key} className={`py-2 px-3 text-gray-700 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                  {c.key === 'name'
                    ? <span><span className="font-medium text-gray-900">{peer.ticker}</span><br /><span className="text-xs text-gray-400">{peer.name}</span></span>
                    : c.render(peer[c.key])}
                </td>
              ))}
            </tr>
          ))}

          {/* Peer median row */}
          {peerSummary && (
            <tr className="border-t-2 border-gray-200 bg-blue-50">
              <td className="py-2 px-3 font-semibold text-blue-700 text-xs uppercase">Peer Median</td>
              <td className="py-2 px-3 text-right text-blue-700 tabular-nums">—</td>
              {['pe', 'pb', 'ps', 'ev_ebitda', 'ev_revenue'].map((k) => (
                <td key={k} className="py-2 px-3 text-right tabular-nums font-semibold text-blue-700">
                  {fmt(peerSummary[k]?.median)}
                </td>
              ))}
              <td className="py-2 px-3 text-right">—</td>
            </tr>
          )}

          {/* Target row */}
          {targetMultiples && (
            <tr className="bg-primary-50 border-t border-primary-100">
              <td className="py-2 px-3 font-bold text-primary-800 text-xs uppercase">
                {targetTicker} (Target)
              </td>
              <td className="py-2 px-3 text-right">—</td>
              {[
                targetMultiples.pe,
                targetMultiples.pb,
                targetMultiples.ps,
                targetMultiples.ev_ebitda,
                targetMultiples.ev_revenue,
              ].map((v, i) => (
                <td key={i} className="py-2 px-3 text-right tabular-nums font-bold text-primary-700">
                  {fmt(v)}
                </td>
              ))}
              <td className="py-2 px-3 text-right">—</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
