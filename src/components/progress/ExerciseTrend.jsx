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

  const averageMinutes = useMemo(() => {
    if (!data.length) return null;
    const sum = data.reduce((a, b) => a + (b.value ?? 0), 0);
    return sum / data.length;
  }, [data]);

  const dailyData = useMemo(
    () => buildExerciseDailySeries(data, scope),
    [data, scope]
  );

  const avg = useMemo(() => {
    if (!Number.isFinite(averageMinutes)) return null;
    return Math.round(averageMinutes) + ' min';
  }, [averageMinutes]);

  const handlePointClick = (point) => {
    if (point) onDayClick?.({ ...point, dateLabel: point.label, exerciseTypes: point?.extra?.types ?? [] });
  };

  return (
    <TrendCard title="Exercise Minutes" subtitle={scopeLabel(scope)} averageText={avg ?? ''} className="progress-trend-card--exercise">
      {!dailyData.length && <p className="weight-trend__empty weight-trend__empty--top">No data for this range.</p>}
      <div className="trend-chart">
        <LineTrendChart
          data={dailyData}
          valueKey="value"
          labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri']}
          tone="green"
          onPointClick={handlePointClick}
          showArea={true}
          averageValue={dailyData.length > 1 ? averageMinutes : null}
        />
      </div>
    </TrendCard>
  );
}

function scopeLabel(s) {
  if (s === 'all') return 'Daily totals';
  if (s === 'month') return 'Daily totals, last 30 days';
  return 'Daily totals, this week';
}

function formatExerciseDay(dateStr) {
  const date = new Date(dateStr);
  if (!Number.isFinite(date.getTime())) return String(dateStr || '');
  return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

function buildExerciseDailySeries(data, scope) {
  const pointsByDate = new Map((data || []).map((point) => [point.date, point]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let startDate = new Date(today);
  if (scope === 'week') {
    startDate.setDate(today.getDate() - 6);
  } else if (scope === 'month') {
    startDate.setDate(today.getDate() - 29);
  } else {
    const firstPoint = (data || [])[0];
    if (firstPoint?.date) {
      const firstDate = new Date(firstPoint.date);
      if (Number.isFinite(firstDate.getTime())) {
        startDate = firstDate;
      }
    }
  }

  startDate.setHours(0, 0, 0, 0);

  const series = [];
  const cursor = new Date(startDate);
  while (cursor <= today) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const point = pointsByDate.get(dateStr);
    series.push(
      point
        ? { ...point, label: formatExerciseDay(point.date) }
        : {
            date: dateStr,
            label: formatExerciseDay(dateStr),
            value: 0,
            extra: { types: [] },
          }
    );
    cursor.setDate(cursor.getDate() + 1);
  }

  return series;
}
