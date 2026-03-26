import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = {
  Promoter: '#1d4ed8',
  FII: '#15803d',
  DII: '#b45309',
  Public: '#6d28d9',
  Other: '#9ca3af',
};

const RADIAN = Math.PI / 180;
function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.04) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  );
}

const ShareholdingChart = ({ shareholders, viewMode = 'research' }) => {
  const t = viewMode === 'terminal';

  const chartData = useMemo(() => {
    if (!shareholders || shareholders.length === 0) return null;

    // shareholders is an array of { holder, percentage, shares, value } objects
    // Group into standard categories
    const categories = { Promoter: 0, FII: 0, DII: 0, Public: 0, Other: 0 };

    shareholders.forEach(({ holder = '', percentage }) => {
      if (percentage == null) return;
      const h = holder.toLowerCase();
      if (h.includes('promoter') || h.includes('founder') || h.includes('insider')) {
        categories.Promoter += percentage;
      } else if (h.includes('fii') || h.includes('foreign') || h.includes('f.i.i') || h.includes('overseas')) {
        categories.FII += percentage;
      } else if (h.includes('dii') || h.includes('mutual fund') || h.includes('insurance') || h.includes('d.i.i')) {
        categories.DII += percentage;
      } else if (h.includes('public') || h.includes('retail') || h.includes('individual')) {
        categories.Public += percentage;
      } else {
        categories.Other += percentage;
      }
    });

    // If no categorization worked (e.g. different label format), try direct mapping
    const total = Object.values(categories).reduce((a, b) => a + b, 0);
    if (total === 0) {
      // Try treating top holders directly
      return shareholders.slice(0, 5).map(({ holder, percentage }) => ({
        name: holder?.length > 20 ? holder.slice(0, 20) + '…' : holder || 'Unknown',
        value: percentage ? parseFloat((percentage * 100).toFixed(2)) : 0,
      })).filter(d => d.value > 0);
    }

    return Object.entries(categories)
      .filter(([, v]) => v > 0)
      .map(([name, v]) => ({
        name,
        value: parseFloat((v * 100).toFixed(2)),
      }));
  }, [shareholders]);

  if (!chartData || chartData.length === 0) {
    return (
      <div style={{
        height: 220,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: t ? '#0f1f30' : '#f9fafb',
        border: `1px solid ${t ? '#1e3048' : '#e5e7eb'}`,
        borderRadius: 8,
      }}>
        <p style={{ color: t ? '#475569' : '#9ca3af', fontSize: 13 }}>No shareholding data available</p>
      </div>
    );
  }

  const bgColor = t ? '#0f1f30' : '#ffffff';
  const legendStyle = { fontSize: 11, color: t ? '#94a3b8' : '#6b7280' };

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: t ? '#162032' : '#fff',
        border: `1px solid ${t ? '#243a52' : '#e5e7eb'}`,
        padding: '8px 12px',
        fontSize: 12,
        borderRadius: 6,
      }}>
        <p style={{ color: t ? '#f59e0b' : '#111827', fontWeight: 700, marginBottom: 2 }}>
          {payload[0].name}
        </p>
        <p style={{ color: payload[0].payload.fill || '#6b7280', margin: 0 }}>
          {payload[0].value}%
        </p>
      </div>
    );
  };

  return (
    <div style={{ background: bgColor }}>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
            labelLine={false}
            label={renderCustomLabel}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={entry.name}
                fill={COLORS[entry.name] || Object.values(COLORS)[index % Object.values(COLORS).length]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ShareholdingChart;
