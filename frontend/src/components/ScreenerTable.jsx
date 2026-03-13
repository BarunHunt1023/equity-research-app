/**
 * ScreenerTable — renders a single screener.in-style financial table.
 *
 * Props:
 *   title        {string}  — e.g. "Quarterly Results"
 *   companyName  {string}  — displayed in the header
 *   denomination {string}  — e.g. "Rs Cr"
 *   columns      {string[]}— column headers (e.g. ["Mar-22", "Jun-22", ..., "TTM"])
 *   rows         {Array}   — [{label, type, values}]
 *                            type: "bold" | "normal" | "italic" | "section"
 *                            values: (number|null)[] aligned with columns
 *   trendColumns {string[]}— optional: ["9 YEARS", "7 YEARS", "5 YEARS", "3 YEARS"]
 *   trendRows    {Array}   — optional: same shape as rows but for trend panel
 *   viewMode     {string}  — "research" | "terminal"
 */
export default function ScreenerTable({
  title = '',
  companyName = '',
  denomination = 'Rs Cr',
  columns = [],
  rows = [],
  trendColumns = [],
  trendRows = [],
  viewMode = 'research',
}) {
  const t = viewMode === 'terminal'

  // ── Formatters ──────────────────────────────────────────────────────────
  function fmtVal(value, rowType) {
    if (value === null || value === undefined) return '—'
    if (rowType === 'italic') {
      // Percentage / ratio values stored as floats (e.g. 13.5 → "14%" or "13.5%")
      const n = Number(value)
      if (isNaN(n)) return String(value)
      // If it looks like a ratio (small number, not percentage), show as-is with 1 decimal
      if (Math.abs(n) < 50 && String(value).indexOf('.') !== -1) {
        return n.toFixed(1)
      }
      return Math.round(n).toString() + '%'
    }
    // Absolute values: integer
    const n = Number(value)
    if (isNaN(n)) return String(value)
    if (n < 0) return `(${Math.abs(Math.round(n)).toLocaleString('en-IN')})`
    return Math.round(n).toLocaleString('en-IN')
  }

  function fmtTrend(value) {
    if (value === null || value === undefined) return '—'
    const n = Number(value)
    if (isNaN(n)) return '—'
    return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'
  }

  // ── Row styling ──────────────────────────────────────────────────────────
  function rowClass(type) {
    if (t) {
      // Terminal theme
      if (type === 'bold')    return 'font-bold text-white bg-[#0f1f30] border-b border-[#1e3048]'
      if (type === 'italic')  return 'italic text-amber-300 bg-[#0b1929] border-b border-[#1e3048] text-xs'
      if (type === 'section') return 'text-slate-500 bg-[#162032] border-b border-[#243a52] text-xs font-semibold uppercase tracking-widest'
      return 'text-slate-300 bg-[#0f1f30] border-b border-[#1e3048]'
    }
    // Research theme
    if (type === 'bold')    return 'font-bold text-gray-900 bg-white border-b border-gray-100'
    if (type === 'italic')  return 'italic text-blue-600 bg-blue-50/40 border-b border-gray-100 text-xs'
    if (type === 'section') return 'text-gray-400 bg-gray-100 border-b border-gray-200 text-xs font-semibold uppercase tracking-widest'
    return 'text-gray-700 bg-white border-b border-gray-100'
  }

  function cellClass(type) {
    if (type === 'section') return 'py-1 px-3'
    return 'py-1.5 px-3'
  }

  function valueCellClass(type) {
    const base = 'tabular-nums text-right px-3 whitespace-nowrap'
    if (type === 'italic') return `${base} py-1`
    return `${base} py-1.5`
  }

  function trendCellClass(value) {
    if (value === null || value === undefined) return 'tabular-nums text-right px-3 py-1 text-xs text-gray-400'
    const n = Number(value)
    if (isNaN(n)) return 'tabular-nums text-right px-3 py-1 text-xs text-gray-400'
    if (n > 0) return 'tabular-nums text-right px-3 py-1 text-xs text-green-600 font-medium'
    if (n < 0) return 'tabular-nums text-right px-3 py-1 text-xs text-red-500 font-medium'
    return 'tabular-nums text-right px-3 py-1 text-xs text-gray-500'
  }

  const hasTrend = trendColumns.length > 0 && trendRows.length > 0

  if (!columns.length || !rows.length) {
    return (
      <div className={`p-6 text-center text-sm ${t ? 'text-slate-500' : 'text-gray-400'}`}>
        No data available for this period.
      </div>
    )
  }

  return (
    <div className={`overflow-hidden ${t ? 'bg-[#0b1929]' : 'bg-white'}`}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-[#0a1628] px-4 py-3 text-center">
        <div className={`text-base font-bold text-white tracking-wide ${t ? 'font-mono' : ''}`}>
          {title}
        </div>
        {companyName && (
          <div className={`text-sm font-semibold text-white/80 mt-0.5 ${t ? 'font-mono' : ''}`}>
            {companyName}
          </div>
        )}
      </div>

      {/* ── Table wrapper with horizontal scroll ────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse" style={{ minWidth: `${(columns.length + 1) * 72 + (hasTrend ? trendColumns.length * 80 + 40 : 0)}px` }}>
          {/* Column header row */}
          <thead>
            <tr className={t ? 'bg-[#0f2040]' : 'bg-gray-50'}>
              {/* Narration / denomination label */}
              <th
                className={`sticky left-0 z-20 text-left px-3 py-2 font-semibold whitespace-nowrap border-b border-r ${
                  t
                    ? 'bg-[#0f2040] text-amber-400 border-[#1e3048]'
                    : 'bg-gray-50 text-gray-600 border-gray-200'
                }`}
                style={{ minWidth: '160px' }}
              >
                {denomination}
              </th>

              {/* Data columns */}
              {columns.map((col, ci) => (
                <th
                  key={`col-${ci}`}
                  className={`text-right px-3 py-2 font-semibold whitespace-nowrap border-b ${
                    t
                      ? 'text-amber-400 border-[#1e3048]'
                      : 'text-gray-700 border-gray-200'
                  } ${col === 'TTM' || col === 'LTM' ? (t ? 'text-amber-300' : 'text-blue-700 font-bold') : ''}`}
                  style={{ minWidth: '64px' }}
                >
                  {col}
                </th>
              ))}

              {/* Trend panel header */}
              {hasTrend && (
                <>
                  {/* Separator */}
                  <th className={`px-2 border-b border-l-2 ${t ? 'border-[#1e3048] border-l-amber-400/30' : 'border-gray-200 border-l-blue-200'}`} style={{ minWidth: '16px' }} />
                  {trendColumns.map((tc, ti) => (
                    <th
                      key={`tc-${ti}`}
                      className={`text-right px-3 py-2 font-semibold whitespace-nowrap border-b ${
                        t ? 'bg-[#0f2040] text-amber-400 border-[#1e3048]' : 'bg-[#0a1628] text-white border-gray-200'
                      }`}
                      style={{ minWidth: '72px' }}
                    >
                      {tc}
                    </th>
                  ))}
                </>
              )}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, ri) => {
              const trendRow = hasTrend ? trendRows[ri] : null

              if (row.type === 'section') {
                return (
                  <tr key={`row-${ri}`} className={rowClass('section')}>
                    <td
                      colSpan={columns.length + 1 + (hasTrend ? trendColumns.length + 1 : 0)}
                      className={`sticky left-0 z-10 ${cellClass('section')} ${
                        t ? 'bg-[#162032] text-slate-500' : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {row.label || '\u00A0'}
                    </td>
                  </tr>
                )
              }

              return (
                <tr key={`row-${ri}`} className={`${rowClass(row.type)} hover:opacity-80 transition-opacity`}>
                  {/* Label cell — sticky */}
                  <td
                    className={`sticky left-0 z-10 ${cellClass(row.type)} font-${row.type === 'bold' ? 'bold' : 'normal'} border-r whitespace-nowrap ${
                      t
                        ? `bg-[${row.type === 'bold' ? '#0f1f30' : row.type === 'italic' ? '#0b1929' : '#0f1f30'}] border-[#1e3048]`
                        : `bg-[${row.type === 'bold' ? 'white' : row.type === 'italic' ? '#eff6ff' : 'white'}] border-gray-100`
                    }`}
                    style={{
                      minWidth: '160px',
                      backgroundColor: t
                        ? (row.type === 'italic' ? '#0b1929' : '#0f1f30')
                        : (row.type === 'italic' ? '#eff6ff40' : 'white'),
                    }}
                  >
                    {row.label}
                  </td>

                  {/* Value cells */}
                  {(row.values || []).map((val, vi) => (
                    <td
                      key={`val-${vi}`}
                      className={valueCellClass(row.type)}
                    >
                      {fmtVal(val, row.type)}
                    </td>
                  ))}

                  {/* Trend cells */}
                  {hasTrend && (
                    <>
                      <td className={`border-l-2 ${t ? 'border-amber-400/30' : 'border-blue-100'}`} />
                      {(trendRow?.values || Array(trendColumns.length).fill(null)).map((tv, ti) => (
                        <td key={`tv-${ti}`} className={trendCellClass(tv)}>
                          {trendRow?.type === 'italic' || trendRow?.type === 'section'
                            ? '—'
                            : fmtTrend(tv)}
                        </td>
                      ))}
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
