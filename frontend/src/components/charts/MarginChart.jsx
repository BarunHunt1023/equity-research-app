import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const MARGIN_CONFIG = [
  { key: 'gross_margin',     label: 'Gross Margin',     researchColor: '#1d4ed8', terminalColor: '#60a5fa' },
  { key: 'ebitda_margin',    label: 'EBITDA Margin',    researchColor: '#15803d', terminalColor: '#34d399' },
  { key: 'operating_margin', label: 'Operating Margin', researchColor: '#92400e', terminalColor: '#fbbf24' },
  { key: 'net_margin',       label: 'Net Margin',       researchColor: '#6d28d9', terminalColor: '#a78bfa' },
];

const MarginChart = ({ historicalMetrics, viewMode = 'research', compact = false }) => {
  const t = viewMode === 'terminal';

  const chartData = useMemo(() => {
    if (!historicalMetrics || historicalMetrics.length === 0) return [];
    return historicalMetrics.map(item => ({
      period: item.period,
      gross_margin:     item.gross_margin     != null ? item.gross_margin * 100     : null,
      ebitda_margin:    item.ebitda_margin    != null ? item.ebitda_margin * 100    : null,
      operating_margin: item.operating_margin != null ? item.operating_margin * 100 : null,
      net_margin:       item.net_margin       != null ? item.net_margin * 100       : null,
    }));
  }, [historicalMetrics]);

  const CustomTooltip = useMemo(() => {
    const bgColor  = t ? '#162032' : '#ffffff';
    const border   = t ? '#243a52' : '#e5e7eb';
    const label    = t ? '#f59e0b' : '#111827';
    return ({ active, payload, labelVal }) => {
      if (!active || !payload || payload.length === 0) return null;
      return (
        <div style={{ background: bgColor, border: `1px solid ${border}`, padding: '10px 14px', fontSize: 12 }}>
          <p style={{ color: label, fontWeight: 700, marginBottom: 4 }}>{payload[0]?.payload?.period}</p>
          {payload.map((entry, i) => (
            <p key={i} style={{ color: entry.color, margin: '2px 0' }}>
              {entry.name}: {entry.value != null ? `${entry.value.toFixed(1)}%` : '--'}
            </p>
          ))}
        </div>
      );
    };
  }, [t]);

  if (!chartData.length) {
    return (
      <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t ? '#0f1f30' : '#f9fafb', border: `1px solid ${t ? '#1e3048' : '#e5e7eb'}` }}>
        <p style={{ color: t ? '#475569' : '#9ca3af', fontSize: 13 }}>No margin data available</p>
      </div>
    );
  }

  const gridColor  = t ? 'rgba(255,255,255,0.05)' : '#f0f0f0';
  const axisColor  = t ? '#475569' : '#9ca3af';
  const bgColor    = t ? '#0f1f30' : '#ffffff';
  const legendStyle = { fontSize: 11, color: t ? '#94a3b8' : '#6b7280' };

  return (
    <div style={{ background: bgColor, height: compact ? '100%' : 'auto', display: compact ? 'flex' : 'block', flexDirection: 'column' }}>
      {!compact && (
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t ? '#f59e0b' : '#0a1628', marginBottom: 12 }}>
          Margin Trends
        </p>
      )}
      <ResponsiveContainer width="100%" height={compact ? '100%' : 300}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: axisColor }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={v => `${v.toFixed(0)}%`}
            tick={{ fontSize: 11, fill: axisColor }}
            tickLine={false}
            axisLine={false}
            width={44}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: t ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)', strokeWidth: 1 }} />
          <Legend wrapperStyle={legendStyle} iconType="plainline" iconSize={14} />
          {MARGIN_CONFIG.map(({ key, label, researchColor, terminalColor }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={label}
              stroke={t ? terminalColor : researchColor}
              strokeWidth={t ? 1.5 : 2}
              dot={{ r: 2.5, strokeWidth: 0, fill: t ? terminalColor : researchColor }}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MarginChart;
