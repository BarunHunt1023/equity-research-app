import React, { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥' };

const formatLargeNumber = (value, currency, unit) => {
  if (value == null || isNaN(value)) return '--';
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const sym = CURRENCY_SYMBOLS[currency] || '$';

  if (unit === 'Cr') {
    if (absValue >= 100000) return `${sym}${sign}${(absValue / 100000).toFixed(1)}L Cr`;
    if (absValue >= 1) return `${sym}${sign}${Math.round(absValue).toLocaleString('en-IN')} Cr`;
    return `${sym}${sign}${absValue.toFixed(1)} Cr`;
  }

  if (absValue >= 1e12) return `${sign}${(absValue / 1e12).toFixed(1)}T`;
  if (absValue >= 1e9) return `${sign}${(absValue / 1e9).toFixed(1)}B`;
  if (absValue >= 1e6) return `${sign}${(absValue / 1e6).toFixed(1)}M`;
  if (absValue >= 1e3) return `${sign}${(absValue / 1e3).toFixed(1)}K`;
  return `${sign}${absValue.toFixed(0)}`;
};

const formatTooltipValue = (value, currency, unit) => {
  if (value == null || isNaN(value)) return '--';
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const sym = CURRENCY_SYMBOLS[currency] || '$';

  if (unit === 'Cr') {
    if (absValue >= 100000) return `${sym}${sign}${(absValue / 100000).toFixed(2)}L Cr`;
    return `${sym}${sign}${Math.round(absValue).toLocaleString('en-IN')} Cr`;
  }

  if (absValue >= 1e12) return `${sym}${sign}${(absValue / 1e12).toFixed(2)}T`;
  if (absValue >= 1e9) return `${sym}${sign}${(absValue / 1e9).toFixed(2)}B`;
  if (absValue >= 1e6) return `${sym}${sign}${(absValue / 1e6).toFixed(2)}M`;
  if (absValue >= 1e3) return `${sym}${sign}${(absValue / 1e3).toFixed(2)}K`;
  return `${sym}${sign}${absValue.toFixed(2)}`;
};

const RevenueEarningsChart = ({ historicalMetrics, currency = 'USD', unit = null }) => {
  const CustomTooltip = useMemo(() => {
    return ({ active, payload, label }) => {
      if (!active || !payload || payload.length === 0) return null;
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
          <p className="font-semibold text-gray-800 mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-gray-600" style={{ color: entry.color }}>
              {entry.name}: {formatTooltipValue(entry.value, currency, unit)}
            </p>
          ))}
        </div>
      );
    };
  }, [currency, unit]);

  const chartData = useMemo(() => {
    if (!historicalMetrics || historicalMetrics.length === 0) return [];
    return historicalMetrics.map((item) => ({
      period: item.period,
      revenue: item.revenue,
      net_income: item.net_income,
    }));
  }, [historicalMetrics]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-400 text-sm">No revenue/earnings data available</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-base font-semibold text-gray-800 mb-3">
        Revenue &amp; Net Income
      </h3>
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#d1d5db' }}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={(val) => formatLargeNumber(val, currency, unit)}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#d1d5db' }}
            width={80}
            label={{
              value: 'Revenue',
              angle: -90,
              position: 'insideLeft',
              offset: -5,
              style: { fontSize: 12, fill: '#3b82f6' },
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(val) => formatLargeNumber(val, currency, unit)}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#d1d5db' }}
            width={80}
            label={{
              value: 'Net Income',
              angle: 90,
              position: 'insideRight',
              offset: -5,
              style: { fontSize: 12, fill: '#10b981' },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            iconType="square"
          />
          <Bar
            yAxisId="left"
            dataKey="revenue"
            name="Revenue"
            fill="#3b82f6"
            radius={[4, 4, 0, 0]}
            barSize={40}
            fillOpacity={0.85}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="net_income"
            name="Net Income"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RevenueEarningsChart;
