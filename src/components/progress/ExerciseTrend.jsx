import React, { useEffect, useMemo, useState } from 'react';
import TrendCard from './TrendCard.jsx';
import LineTrendChart from './LineTrendChart.jsx';
import { fetchExerciseSeries } from '../../services/progressService.js';

export default function ExerciseTrend({ userId, scope, onDayClick }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    let active = true;
    fetchExerciseSeries(userId, scope).then(d => { if (active) setData(d); });
    return () => { active = false; };
  }, [userId, scope]);

  const avg = useMemo(() => {
    if (!data.length) return null;
    const sum = data.reduce((a, b) => a + (b.value ?? 0), 0);
    return Math.round(sum / data.length) + ' min';
  }, [data]);

  const handlePointClick = (point) => {
    if (scope !== 'week') return;
    if (point) onDayClick?.({ dateLabel: point.label, exerciseTypes: point?.extra?.types ?? [] });
  };

  return (
    <TrendCard title="Exercise Minutes" subtitle={scopeLabel(scope)} averageText={avg ?? ''} className="progress-trend-card--exercise">
      {!data.length && <p className="weight-trend__empty weight-trend__empty--top">No data for this range.</p>}
      <div className="trend-chart">
        <LineTrendChart
          data={data}
          valueKey="value"
          labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri']}
          tone="green"
          onPointClick={handlePointClick}
        />
      </div>
    </TrendCard>
  );
}

function scopeLabel(s) {
  if (s === 'all') return 'Overall totals';
  if (s === 'month') return 'Last 30 days';
  return 'This week (click a day)';
}
