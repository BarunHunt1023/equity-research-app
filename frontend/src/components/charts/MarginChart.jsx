import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

/**
 * Margin metadata defining display properties for each margin type.
 */
const MARGIN_CONFIG = [
  { key: 'gross_margin', label: 'Gross Margin', color: '#3b82f6', fillOpacity: 0.15 },
  { key: 'ebitda_margin', label: 'EBITDA Margin', color: '#10b981', fillOpacity: 0.15 },
  { key: 'operating_margin', label: 'Operating Margin', color: '#f97316', fillOpacity: 0.15 },
  { key: 'net_margin', label: 'Net Margin', color: '#8b5cf6', fillOpacity: 0.15 },
];

/**
 * Formats a decimal margin value as a percentage string.
 * @param {number} value - Decimal value (e.g., 0.35 for 35%).
 * @returns {string} Percentage string (e.g., "35.0%").
 */
const formatPercent = (value) => {
  if (value == null || isNaN(value)) return '--';
  return `${(value * 100).toFixed(1)}%`;
};

/**
 * Formats a percentage value for the Y-axis tick.
 * @param {number} value - Already-multiplied percentage value.
 * @returns {string} Percentage string for axis display.
 */
const formatAxisPercent = (value) => {
  if (value == null || isNaN(value)) return '--';
  return `${value.toFixed(0)}%`;
};

/**
 * Custom tooltip component for the Margin chart.
 */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600">
            {entry.name}: {entry.value != null ? `${entry.value.toFixed(1)}%` : '--'}
          </span>
        </p>
      ))}
    </div>
  );
};

/**
 * MarginChart
 *
 * An area chart showing margin trends (Gross, EBITDA, Operating, Net) over time.
 * Values are multiplied by 100 to display as percentages.
 *
 * @param {Object} props
 * @param {Array<{period: string, gross_margin: number, ebitda_margin: number, operating_margin: number, net_margin: number}>} props.historicalMetrics
 *   Array of historical data points with decimal margin values.
 */
const MarginChart = ({ historicalMetrics }) => {
  const chartData = useMemo(() => {
    if (!historicalMetrics || historicalMetrics.length === 0) return [];
    return historicalMetrics.map((item) => ({
      period: item.period,
      gross_margin: item.gross_margin != null ? item.gross_margin * 100 : null,
      ebitda_margin: item.ebitda_margin != null ? item.ebitda_margin * 100 : null,
      operating_margin: item.operating_margin != null ? item.operating_margin * 100 : null,
      net_margin: item.net_margin != null ? item.net_margin * 100 : null,
    }));
  }, [historicalMetrics]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-400 text-sm">No margin data available</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-base font-semibold text-gray-800 mb-3">
        Margin Trends
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
        >
          <defs>
            {MARGIN_CONFIG.map(({ key, color }) => (
              <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#d1d5db' }}
          />
          <YAxis
            tickFormatter={formatAxisPercent}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#d1d5db' }}
            width={55}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            iconType="square"
          />
          {MARGIN_CONFIG.map(({ key, label, color }) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              name={label}
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${key})`}
              dot={{ r: 3, fill: color, strokeWidth: 1, stroke: '#fff' }}
              activeDot={{ r: 5, fill: color, strokeWidth: 2, stroke: '#fff' }}
              stackId="1"
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MarginChart;
