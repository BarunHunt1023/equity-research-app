import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

/**
 * Formats a numeric value into a human-readable string with B/M/K suffixes.
 * @param {number} value - The raw numeric value.
 * @returns {string} Formatted string (e.g., "12.3B", "450M").
 */
const formatLargeNumber = (value) => {
  if (value == null || isNaN(value)) return '--';
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1e12) return `${sign}${(absValue / 1e12).toFixed(1)}T`;
  if (absValue >= 1e9) return `${sign}${(absValue / 1e9).toFixed(1)}B`;
  if (absValue >= 1e6) return `${sign}${(absValue / 1e6).toFixed(1)}M`;
  if (absValue >= 1e3) return `${sign}${(absValue / 1e3).toFixed(1)}K`;
  return `${sign}${absValue.toFixed(0)}`;
};

/**
 * Formats a value for the tooltip with full precision and dollar sign.
 * @param {number} value - The raw numeric value.
 * @returns {string} Formatted dollar string.
 */
const formatTooltipValue = (value) => {
  if (value == null || isNaN(value)) return '--';
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1e12) return `$${sign}${(absValue / 1e12).toFixed(2)}T`;
  if (absValue >= 1e9) return `$${sign}${(absValue / 1e9).toFixed(2)}B`;
  if (absValue >= 1e6) return `$${sign}${(absValue / 1e6).toFixed(2)}M`;
  if (absValue >= 1e3) return `$${sign}${(absValue / 1e3).toFixed(2)}K`;
  return `$${sign}${absValue.toFixed(2)}`;
};

/**
 * Custom tooltip for the waterfall chart.
 */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{data.label}</p>
      <p className="text-gray-600">
        Value: {formatTooltipValue(data.actualValue)}
      </p>
      {data.isTotal && (
        <p className="text-gray-500 text-xs mt-1">Running Total</p>
      )}
    </div>
  );
};

/**
 * Custom bar label to show the value above/below each bar.
 */
const CustomBarLabel = ({ x, y, width, height, value, payload }) => {
  if (!payload || payload.actualValue == null) return null;

  const displayValue = formatLargeNumber(payload.actualValue);
  const isNegative = payload.actualValue < 0;
  const yPos = isNegative ? y + height + 14 : y - 8;

  return (
    <text
      x={x + width / 2}
      y={yPos}
      fill="#374151"
      textAnchor="middle"
      fontSize={11}
      fontWeight={500}
    >
      {payload.actualValue < 0 ? '' : '$'}{displayValue.startsWith('-') ? `-$${displayValue.slice(1)}` : `$${displayValue}`}
    </text>
  );
};

/**
 * FCFWaterfallChart
 *
 * A waterfall chart showing the bridge from EBITDA to Free Cash Flow.
 * Uses stacked bars with an invisible base to simulate waterfall steps.
 *
 * @param {Object} props
 * @param {Object} props.forecast - Forecast object containing a projections array.
 * @param {Array} props.forecast.projections - Array of projection objects with
 *   ebitda, depreciation_amortization, nopat, capex, delta_nwc, fcf fields.
 */
const FCFWaterfallChart = ({ forecast }) => {
  const chartData = useMemo(() => {
    if (!forecast?.projections || forecast.projections.length === 0) return [];

    const proj = forecast.projections[0];

    const ebitda = proj.ebitda || 0;
    const da = proj.depreciation_amortization || 0;
    const nopat = proj.nopat || 0;
    const capex = proj.capex || 0;
    const deltaNwc = proj.delta_nwc || 0;
    const fcf = proj.fcf || 0;

    // Build waterfall steps
    // Each step: { label, actualValue, base (invisible), bar (visible), color, isTotal }
    const steps = [];
    let runningTotal = 0;

    // Step 1: EBITDA (starting point - total bar)
    steps.push({
      label: 'EBITDA',
      actualValue: ebitda,
      base: 0,
      bar: ebitda,
      color: '#3b82f6',
      isTotal: true,
    });
    runningTotal = ebitda;

    // Step 2: D&A (subtracted from EBITDA)
    const daEffect = -Math.abs(da);
    steps.push({
      label: 'D&A',
      actualValue: daEffect,
      base: runningTotal + daEffect,
      bar: Math.abs(daEffect),
      color: '#ef4444',
      isTotal: false,
    });
    runningTotal += daEffect;

    // Step 3: Taxes (difference between EBIT and NOPAT)
    const ebit = ebitda - Math.abs(da);
    const taxEffect = nopat - ebit;
    steps.push({
      label: 'Taxes',
      actualValue: taxEffect,
      base: taxEffect < 0 ? runningTotal + taxEffect : runningTotal,
      bar: Math.abs(taxEffect),
      color: taxEffect >= 0 ? '#10b981' : '#ef4444',
      isTotal: false,
    });
    runningTotal += taxEffect;

    // Step 4: NOPAT subtotal
    steps.push({
      label: 'NOPAT',
      actualValue: nopat,
      base: 0,
      bar: nopat,
      color: '#6366f1',
      isTotal: true,
    });
    runningTotal = nopat;

    // Step 5: CapEx (subtracted)
    const capexEffect = -Math.abs(capex);
    steps.push({
      label: 'CapEx',
      actualValue: capexEffect,
      base: runningTotal + capexEffect,
      bar: Math.abs(capexEffect),
      color: '#ef4444',
      isTotal: false,
    });
    runningTotal += capexEffect;

    // Step 6: Change in NWC
    const nwcEffect = -deltaNwc;
    steps.push({
      label: '\u0394 NWC',
      actualValue: nwcEffect,
      base: nwcEffect < 0 ? runningTotal + nwcEffect : runningTotal,
      bar: Math.abs(nwcEffect),
      color: nwcEffect >= 0 ? '#10b981' : '#ef4444',
      isTotal: false,
    });
    runningTotal += nwcEffect;

    // Step 7: FCF (final total)
    steps.push({
      label: 'FCF',
      actualValue: fcf,
      base: 0,
      bar: Math.abs(fcf),
      color: fcf >= 0 ? '#10b981' : '#ef4444',
      isTotal: true,
    });

    return steps;
  }, [forecast]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-400 text-sm">No forecast data available</p>
      </div>
    );
  }

  const year = forecast?.projections?.[0]?.year || forecast?.projections?.[0]?.period || '';

  return (
    <div className="w-full">
      <h3 className="text-base font-semibold text-gray-800 mb-1">
        EBITDA to FCF Bridge
      </h3>
      {year && (
        <p className="text-xs text-gray-500 mb-3">Projection Year: {year}</p>
      )}
      <ResponsiveContainer width="100%" height={350}>
        <BarChart
          data={chartData}
          margin={{ top: 25, right: 30, left: 20, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#d1d5db' }}
          />
          <YAxis
            tickFormatter={(val) => `$${formatLargeNumber(val)}`}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#d1d5db' }}
            width={70}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={1} />
          {/* Invisible base bar */}
          <Bar
            dataKey="base"
            stackId="waterfall"
            fill="transparent"
            isAnimationActive={false}
          />
          {/* Visible value bar */}
          <Bar
            dataKey="bar"
            stackId="waterfall"
            radius={[4, 4, 0, 0]}
            label={<CustomBarLabel />}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                fillOpacity={entry.isTotal ? 0.9 : 0.75}
                stroke={entry.color}
                strokeWidth={entry.isTotal ? 1 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default FCFWaterfallChart;
