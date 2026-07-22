import React, { useEffect, useMemo, useState } from 'react';
import TrendCard from './TrendCard.jsx';
import LineTrendChart from './LineTrendChart.jsx';
import { fetchWeightSeries } from '../../services/progressService.js';
import './WeightTrend.css';

function kgToLb(value) {
  return Number(value || 0) / 0.45359237;
}

function convertWeight(valueKg, unit) {
  if (!Number.isFinite(Number(valueKg))) return 0;
  return unit === 'lb' ? kgToLb(valueKg) : Number(valueKg);
}

export default function WeightTrend({ userId, scope, unit = 'kg', onUnitChange, onDayClick }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    let active = true;
    fetchWeightSeries(userId, scope).then((rows) => {
      if (active) setData(rows);
    });
    return () => {
      active = false;
    };
  }, [userId, scope]);

  const displayData = useMemo(
    () => data.map((point) => ({
      ...point,
      displayValue: Number(convertWeight(point.value, unit).toFixed(1)),
    })),
    [data, unit]
  );

  const currentWeightText = useMemo(() => {
    if (!displayData.length) return '';
    const latest = displayData[displayData.length - 1];
    return `Current Weight ${latest.displayValue.toFixed(1)} ${unit}`;
  }, [displayData, unit]);

  const handlePointClick = (point) => {
    if (point) {
      onDayClick?.({
        ...point,
        dateLabel: point.label,
        weight: point.displayValue,
        weightUnit: unit,
      });
    }
  };

  return (
    <TrendCard
      title="Weight"
      subtitle={currentWeightText}
      averageText=""
      className="progress-trend-card--weight"
      actions={
        <div className="weight-unit-toggle">
          <button
            type="button"
            className={unit === 'kg' ? 'weight-unit-toggle__btn is-active' : 'weight-unit-toggle__btn'}
            onClick={() => onUnitChange?.('kg')}
          >
            kg
          </button>
          <button
            type="button"
            className={unit === 'lb' ? 'weight-unit-toggle__btn is-active' : 'weight-unit-toggle__btn'}
            onClick={() => onUnitChange?.('lb')}
          >
            lb
          </button>
        </div>
      }
    >
      {!displayData.length && <p className="weight-trend__empty weight-trend__empty--top">No data for this range.</p>}
      <div className="trend-chart">
        <LineTrendChart
          data={displayData}
          valueKey="displayValue"
          labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri']}
          tone="deep-green"
          onPointClick={handlePointClick}
          showArea={true}
        />
      </div>
    </TrendCard>
  );
}
