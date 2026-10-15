import React from 'react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { formatDayShort, formatDay, formatValueByKind, formatCount } from '../../services/format';

export const CHART_COLORS = ['#0170B9', '#3F9BC7', '#059669', '#015A92', '#64748B', '#D97706'];

const axisProps = { tick: { fontSize: 11, fill: '#64748B' }, tickLine: false, axisLine: { stroke: '#E2E8F0' } };

const TooltipBox = ({ active, payload, label, kind, currency }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__title">{formatDay(label)}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="chart-tooltip__row">
          <span className="chart-tooltip__dot" style={{ background: p.color }} />
          <span>{p.name}</span>
          <strong>{p.value === null || p.value === undefined ? 'No data' : formatValueByKind(p.value, kind, currency)}</strong>
        </div>
      ))}
    </div>
  );
};

/**
 * Daily trend chart. Days the API did not return are not plotted (no fabricated zeros).
 * series: [{ key, label }]; kind: 'count' | 'currency'
 */
export const TrendChart = ({ data, series, kind = 'count', currency, type = 'area', height = 280 }) => {
  if (!series?.length) return null;
  const yFormatter = v => (kind === 'currency' ? Number(v).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 }) : formatCount(v));
  const common = (
    <>
      <CartesianGrid stroke="#F1F5F9" vertical={false} />
      <XAxis dataKey="date" tickFormatter={formatDayShort} minTickGap={24} {...axisProps} />
      <YAxis tickFormatter={yFormatter} width={56} {...axisProps} />
      <Tooltip content={<TooltipBox kind={kind} currency={currency} />} cursor={{ fill: 'rgba(1,112,185,0.06)' }} />
      {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />}
    </>
  );
  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {type === 'bar' ? (
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {common}
            {series.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={28} />)}
          </BarChart>
        ) : type === 'line' ? (
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {common}
            {series.map((s, i) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2.2} dot={false} connectNulls={false} />)}
          </LineChart>
        ) : (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {series.map((s, i) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            {common}
            {series.map((s, i) => <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2.2} fill={`url(#grad-${s.key})`} connectNulls={false} />)}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Revenue composition donut for metrics that are all available.
 */
export const BreakdownDonut = ({ items, currency, height = 220 }) => {
  const usable = items.filter(i => i.value !== null && i.value !== undefined && i.value > 0);
  if (!usable.length) return null;
  const total = usable.reduce((s, i) => s + i.value, 0);
  return (
    <div className="donut">
      <div style={{ height, width: '100%' }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={usable} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="none">
              {usable.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={v => formatValueByKind(v, 'currency', currency)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="donut__legend">
        {usable.map((i, idx) => (
          <li key={i.key}>
            <span className="chart-tooltip__dot" style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }} />
            <span className="grow">{i.label}</span>
            <strong className="tabular">{formatValueByKind(i.value, 'currency', currency)}</strong>
            <span className="text-faint tabular">{((i.value / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
