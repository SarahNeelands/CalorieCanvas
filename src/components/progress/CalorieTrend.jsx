import React, { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import TrendCard from './TrendCard.jsx';
import { fetchCalorieSeries } from '../../services/progressService.js';

export default function CalorieTrend({ userId, scope, onDayClick }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    let active = true;
    fetchCalorieSeries(userId, scope).then(d => { if (active) setData(d); });
    return () => { active = false; };
  }, [userId, scope]);

  const avg = useMemo(() => {
    if (!data.length) return null;
    const sum = data.reduce((a, b) => a + (b.value ?? 0), 0);
    return Math.round(sum / data.length) + ' cal';
  }, [data]);

  const handleClick = (state) => {
    if (!state?.activeLabel || scope !== 'week') return;
    const idx = state?.activeTooltipIndex ?? -1;
    const point = data[idx];
    if (point) onDayClick?.({ dateLabel: point.label, calories: point.value });
  };

  return (
    <TrendCard title="Calorie Intake" subtitle={scopeLabel(scope)} averageText={avg ?? ''}>
      <div style={{ height: 260 }}>
        <ResponsiveContainer>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
            onClick={handleClick}
          >
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke="" fillOpacity={0.15} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {!data.length && <p className="mt-3 text-sm opacity-70">No data for this range.</p>}
    </TrendCard>
  );
}

function scopeLabel(s) {
  if (s === 'all') return 'Overall trend';
  if (s === 'month') return 'Last 30 days';
  return 'This week (click a day)';
}
