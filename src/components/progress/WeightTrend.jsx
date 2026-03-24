import React, { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import TrendCard from './TrendCard.jsx';
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

  const avg = useMemo(() => {
    if (!displayData.length) return null;
    const sum = displayData.reduce((total, point) => total + (point.displayValue ?? 0), 0);
    return `${(sum / displayData.length).toFixed(1)} ${unit}`;
  }, [displayData, unit]);

  const handleClick = (state) => {
    const index = state?.activeTooltipIndex ?? -1;
    const point = displayData[index];
    if (point) {
      onDayClick?.({
        dateLabel: point.label,
        weight: point.displayValue,
        weightUnit: unit,
      });
    }
  };

  return (
    <TrendCard
      title="Weight"
      subtitle={scopeLabel(scope)}
      averageText={avg ?? ''}
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
      <div className="trend-chart">
        <ResponsiveContainer>
          <AreaChart
            data={displayData}
            margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
            onClick={handleClick}
          >
            <XAxis dataKey="label" />
            <YAxis domain={['dataMin - 2', 'dataMax + 2']} />
            <Tooltip formatter={(value) => [`${value} ${unit}`, 'Weight']} />
            <Area
              type="monotone"
              dataKey="displayValue"
              stroke=""
              fillOpacity={0.15}
              dot={{ r: 4 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {!displayData.length && <p className="weight-trend__empty">No data for this range.</p>}
    </TrendCard>
  );
}

function scopeLabel(scope) {
  if (scope === 'all') return 'Overall trend';
  if (scope === 'month') return 'Last 30 days';
  return 'This week';
}
