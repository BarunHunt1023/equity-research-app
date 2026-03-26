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

const formatNum = (value, currency, unit) => {
  if (value == null || isNaN(value)) return '--';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const sym = CURRENCY_SYMBOLS[currency] || '$';

  if (unit === 'Cr') {
    if (abs >= 100000) return `${sym}${sign}${(abs / 100000).toFixed(1)}L`;
    if (abs >= 1) return `${sym}${sign}${Math.round(abs).toLocaleString('en-IN')}`;
    return `${sym}${sign}${abs.toFixed(1)}`;
  }
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
};

const RevenueEarningsChart = ({ historicalMetrics, currency = 'USD', unit = null, viewMode = 'research', compact = false }) => {
  const t = viewMode === 'terminal';

  const CustomTooltip = useMemo(() => {
    const bgClass = t ? '#162032' : '#ffffff';
    const borderColor = t ? '#243a52' : '#e5e7eb';
    const labelColor = t ? '#f59e0b' : '#111827';
    const textColor = t ? '#94a3b8' : '#4b5563';

    return ({ active, payload, label }) => {
      if (!active || !payload || payload.length === 0) return null;
      return (
        <div style={{ background: bgClass, border: `1px solid ${borderColor}`, padding: '10px 14px', fontSize: 12 }}>
          <p style={{ color: labelColor, fontWeight: 700, marginBottom: 4 }}>{label}</p>
          {payload.map((entry, i) => (
            <p key={i} style={{ color: entry.color, margin: '2px 0' }}>
              {entry.name}: {formatNum(entry.value, currency, unit)}
            </p>
          ))}
        </div>
      );
    };
  }, [currency, unit, t]);

  const chartData = useMemo(() => {
    if (!historicalMetrics || historicalMetrics.length === 0) return [];
    return historicalMetrics.map(item => ({
      period: item.period,
      revenue: item.revenue,
      ebitda: item.ebitda,
      net_income: item.net_income,
    }));
  }, [historicalMetrics]);

  if (!chartData.length) {
    return (
      <div
        style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t ? '#0f1f30' : '#f9fafb', border: `1px solid ${t ? '#1e3048' : '#e5e7eb'}` }}
      >
        <p style={{ color: t ? '#475569' : '#9ca3af', fontSize: 13 }}>No revenue data available</p>
      </div>
    );
  }

  // Theme-specific colors
  const gridColor = t ? 'rgba(255,255,255,0.05)' : '#f0f0f0';
  const axisColor = t ? '#475569' : '#9ca3af';
  const revenueColor = t ? '#3b82f6' : '#1e40af';
  const ebitdaColor = t ? '#22c55e' : '#15803d';
  const netIncomeColor = t ? '#f59e0b' : '#b45309';
  const bgColor = t ? '#0f1f30' : '#ffffff';
  const legendStyle = { fontSize: 11, color: t ? '#94a3b8' : '#6b7280' };

  return (
    <div style={{ background: bgColor, height: compact ? '100%' : 'auto', display: compact ? 'flex' : 'block', flexDirection: 'column' }}>
      {!compact && (
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t ? '#f59e0b' : '#0a1628', marginBottom: 12 }}>
          Revenue &amp; Earnings
        </p>
      )}
      <ResponsiveContainer width="100%" height={compact ? '100%' : 300}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: axisColor }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatNum(v, currency, unit)}
            tick={{ fontSize: 11, fill: axisColor }}
            tickLine={false}
            axisLine={false}
            width={72}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: t ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
          <Legend wrapperStyle={legendStyle} iconType="square" iconSize={10} />
          <Bar dataKey="revenue" name="Revenue" fill={revenueColor} radius={[2, 2, 0, 0]} barSize={24} fillOpacity={t ? 0.85 : 0.9} />
          <Bar dataKey="ebitda" name="EBITDA" fill={ebitdaColor} radius={[2, 2, 0, 0]} barSize={24} fillOpacity={t ? 0.85 : 0.9} />
          <Line
            type="monotone"
            dataKey="net_income"
            name="Net Income"
            stroke={netIncomeColor}
            strokeWidth={2}
            dot={{ r: 3, fill: netIncomeColor, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RevenueEarningsChart;
