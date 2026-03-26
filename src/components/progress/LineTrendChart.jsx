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
  showArea = false,
  averageValue = null,
}) {
  const hasData = data.length > 0;
  const points = hasData ? data : labels.map((label) => ({ label, [valueKey]: 0 }));
  const values = points.map((point) => Number(point[valueKey] ?? 0));
  const timestamps = points.map((point, index) => getPointTimestamp(point, index));
  const validTimestamps = timestamps.filter((value) => Number.isFinite(value));
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const min = rawMin === rawMax ? rawMin - getValuePadding(rawMin) : rawMin;
  const max = rawMin === rawMax ? rawMax + getValuePadding(rawMax) : rawMax;
  const spread = max - min || 1;
  const minTimestamp = validTimestamps.length ? Math.min(...validTimestamps) : 0;
  const maxTimestamp = validTimestamps.length ? Math.max(...validTimestamps) : 0;
  const timeSpread = maxTimestamp - minTimestamp || 1;
  const yTicks = [max, max - spread / 2, min];
  const chartLeft = 8;
  const chartRight = 94;
  const chartTop = 14;
  const chartBottom = 76;

  const chartPoints = points.map((point, index) => {
    const timestamp = timestamps[index];
    const x = points.length === 1
      ? (chartLeft + chartRight) / 2
      : Number.isFinite(timestamp)
        ? chartLeft + ((timestamp - minTimestamp) / timeSpread) * (chartRight - chartLeft)
        : chartLeft + ((chartRight - chartLeft) * index) / (points.length - 1);
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

  const sortedChartPoints = [...chartPoints].sort((a, b) => {
    if (a.x !== b.x) return a.x - b.x;
    return a.y - b.y;
  });
  const resolvedLabels = buildXAxisLabels(sortedChartPoints);
  const lineSegments = buildLineSegments(sortedChartPoints, chartBottom);
  const areaSegments = buildAreaSegments(sortedChartPoints, chartBottom);
  const hasAverageLine = hasData && Number.isFinite(Number(averageValue));
  const averageY = hasAverageLine
    ? Number(
        clamp(
          chartBottom - ((Number(averageValue) - min) / spread) * (chartBottom - chartTop),
          chartTop,
          chartBottom
        ).toFixed(2)
      )
    : null;

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
            {showArea ? (
              <>
                {areaSegments.map((segment, index) => (
                  <polygon
                    key={`area-${index}`}
                    className={`line-trend-chart__area line-trend-chart__area--${tone}`}
                    points={segment}
                  />
                ))}
              </>
            ) : null}
            {hasAverageLine ? (
              <line
                className={`line-trend-chart__average line-trend-chart__average--${tone}`}
                x1={chartLeft}
                y1={averageY}
                x2={chartRight}
                y2={averageY}
              />
            ) : null}
            {lineSegments.map((segment, index) => (
              <line
                key={`line-${index}`}
                className={`line-trend-chart__line line-trend-chart__line--${tone}`}
                x1={segment.x1}
                y1={segment.y1}
                x2={segment.x2}
                y2={segment.y2}
              />
            ))}
            {sortedChartPoints.map((point) => (
              <circle
                key={`${point.label}-${point.x}`}
                className={`line-trend-chart__dot line-trend-chart__dot--${tone}`}
                cx={point.x}
                cy={point.y}
                r={sortedChartPoints.length === 1 ? '1.8' : '1.1'}
                onClick={() => onPointClick?.(point.raw)}
              />
            ))}
          </>
        ) : null}
      </svg>

      <div className="line-trend-chart__labels">
        {resolvedLabels.map((label) => (
          <span
            key={`${label.text}-${label.left}`}
            className="line-trend-chart__label"
            style={{ left: `${label.left}%` }}
          >
            {label.text}
          </span>
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

function getValuePadding(value) {
  const magnitude = Math.abs(Number(value) || 0);
  if (magnitude >= 100) return Math.max(10, magnitude * 0.08);
  if (magnitude >= 10) return Math.max(1, magnitude * 0.08);
  return 1;
}

function buildAreaSegments(points, chartBottom) {
  if (points.length < 2) return [];
  const segments = [];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    segments.push(
      `${previous.x},${previous.y} ${current.x},${current.y} ${current.x},${chartBottom} ${previous.x},${chartBottom}`
    );
  }
  return segments;
}

function buildLineSegments(points, chartBottom) {
  if (points.length === 1) {
    const point = points[0];
    return [
      {
        x1: point.x,
        y1: chartBottom,
        x2: point.x,
        y2: point.y,
      },
      {
        x1: Math.max(8, point.x - 8),
        y1: point.y,
        x2: Math.min(94, point.x + 8),
        y2: point.y,
      }
    ];
  }
  if (points.length < 2) return [];
  const segments = [];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    segments.push({
      x1: previous.x,
      y1: previous.y,
      x2: current.x,
      y2: current.y,
    });
  }
  return segments;
}

function getPointTimestamp(point, index) {
  const rawDate = point?.date || point?.logged_at || point?.timestampISO || point?.timestamp_iso || null;
  const parsed = rawDate ? new Date(rawDate).getTime() : Number.NaN;
  if (Number.isFinite(parsed)) {
    return parsed + index;
  }
  return Number.NaN;
}

function buildXAxisLabels(points) {
  if (!points.length) return [];

  const indexes = selectLabelIndexes(points.length);
  return indexes.map((index) => {
    const point = points[index];
    return {
      left: point.x,
      text: formatXAxisLabel(point.raw),
    };
  });
}

function selectLabelIndexes(length) {
  if (length <= 4) {
    return Array.from({ length }, (_, index) => index);
  }

  const indexes = [0, Math.floor((length - 1) / 3), Math.floor((2 * (length - 1)) / 3), length - 1];
  return Array.from(new Set(indexes));
}

function formatXAxisLabel(point) {
  const rawDate = point?.date || point?.logged_at || point?.timestampISO || point?.timestamp_iso || point?.label;
  const date = new Date(rawDate);
  if (Number.isFinite(date.getTime())) {
    return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
  }
  return String(point?.label || '');
}
