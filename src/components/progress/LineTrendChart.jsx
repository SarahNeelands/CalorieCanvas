import React from 'react';
import './LineTrendChart.css';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function LineTrendChart({
  data = [],
  valueKey = 'value',
  labels = [],
  tone = 'green',
  onPointClick,
}) {
  const hasData = data.length > 0;
  const points = hasData ? data : labels.map((label) => ({ label, [valueKey]: 0 }));
  const resolvedLabels = points.map((point) => point.label);
  const values = points.map((point) => Number(point[valueKey] ?? 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const yTicks = [max, max - spread / 2, min];
  const chartLeft = 8;
  const chartRight = 94;
  const chartTop = 14;
  const chartBottom = 76;

  const chartPoints = points.map((point, index) => {
    const x = points.length === 1 ? (chartLeft + chartRight) / 2 : chartLeft + ((chartRight - chartLeft) * index) / (points.length - 1);
    const rawValue = Number(point[valueKey] ?? 0);
    const y = chartBottom - ((rawValue - min) / spread) * (chartBottom - chartTop);
    return {
      x: Number(x.toFixed(2)),
      y: Number(clamp(y, chartTop, chartBottom).toFixed(2)),
      value: rawValue,
      label: point.label,
      raw: point,
    };
  });

  return (
    <div className="line-trend-chart">
      <div className="line-trend-chart__grid">
        <span />
        <span />
        <span />
        <span />
      </div>

      <svg
        className="line-trend-chart__svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label="Trend chart"
      >
        <line className="line-trend-chart__axis" x1={chartLeft} y1={chartTop} x2={chartLeft} y2={chartBottom} />
        <line className="line-trend-chart__axis" x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} />
        {yTicks.map((tick, index) => {
          const y = chartTop + ((chartBottom - chartTop) * index) / (yTicks.length - 1);
          return (
            <g key={`${tick}-${index}`}>
              <line className="line-trend-chart__tick-line" x1={chartLeft} y1={y} x2={chartRight} y2={y} />
              <text className="line-trend-chart__tick-text" x={chartLeft + 0.6} y={y + 1.6}>
                {formatTick(tick)}
              </text>
            </g>
          );
        })}
        {hasData ? (
          <>
            <polyline
              className={`line-trend-chart__area line-trend-chart__area--${tone}`}
              points={`${chartLeft},${chartBottom} ${chartPoints.map((point) => `${point.x},${point.y}`).join(' ')} ${chartRight},${chartBottom}`}
            />
            <polyline
              className={`line-trend-chart__line line-trend-chart__line--${tone}`}
              points={chartPoints.map((point) => `${point.x},${point.y}`).join(' ')}
            />
            {chartPoints.map((point) => (
              <circle
                key={`${point.label}-${point.x}`}
                className={`line-trend-chart__dot line-trend-chart__dot--${tone}`}
                cx={point.x}
                cy={point.y}
                r="1.1"
                onClick={() => onPointClick?.(point.raw)}
              />
            ))}
          </>
        ) : null}
      </svg>

      <div className="line-trend-chart__labels">
        {resolvedLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function formatTick(value) {
  if (!Number.isFinite(value)) return '';
  if (Math.abs(value) >= 100) return Math.round(value);
  if (Math.abs(value) >= 10) return value.toFixed(1).replace(/\.0$/, '');
  return value.toFixed(1).replace(/\.0$/, '');
}
