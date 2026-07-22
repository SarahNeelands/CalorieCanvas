import React, { useEffect, useMemo, useState } from 'react';
import TrendCard from './TrendCard.jsx';
import LineTrendChart from './LineTrendChart.jsx';
import { fetchCalorieSeries } from '../../services/progressService.js';

export default function CalorieTrend({ userId, scope, onDayClick }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    let active = true;
    fetchCalorieSeries(userId, scope).then(d => { if (active) setData(d); });
    return () => { active = false; };
  }, [userId, scope]);

  const averageText = useMemo(() => {
    if (!data.length) return '';
    const sum = data.reduce((total, point) => total + Number(point.value || 0), 0);
    return `Average ${Math.round(sum / data.length)} cal`;
  }, [data]);

  const handlePointClick = (point) => {
    if (point) onDayClick?.({ ...point, dateLabel: point.label, calories: point.value });
  };

  return (
    <TrendCard title="Calorie Intake" subtitle={averageText} averageText="" className="progress-trend-card--calories">
      {!data.length && <p className="weight-trend__empty weight-trend__empty--top">No data for this range.</p>}
      <div className="trend-chart">
        <LineTrendChart
          data={data}
          valueKey="value"
          labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri']}
          tone="gold"
          onPointClick={handlePointClick}
          showArea={true}
        />
      </div>
    </TrendCard>
  );
}
