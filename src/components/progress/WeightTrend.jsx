import React, { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import TrendCard from './TrendCard.jsx';
import { fetchWeightSeries } from '../../services/progressService.js';

export default function WeightTrend({ userId, scope }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    let active = true;
    fetchWeightSeries(userId, scope).then(d => { if (active) setData(d); });
    return () => { active = false; };
  }, [userId, scope]);

  const avg = useMemo(() => {
    if (!data.length) return null;
    const sum = data.reduce((a, b) => a + (b.value ?? 0), 0);
    return (sum / data.length).toFixed(1);
  }, [data]);

  const showWeeklyClick = scope === 'week'; // you said weight has no weekly; this will simply be hidden when [].

  return (
    <TrendCard title="Weight" subtitle={scopeLabel(scope)} averageText={avg ? `${avg} lbs` : ''}>
      <div className="trend-chart">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" />
            <YAxis domain={['dataMin - 2', 'dataMax + 2']} />
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
  return 'This week';
}
