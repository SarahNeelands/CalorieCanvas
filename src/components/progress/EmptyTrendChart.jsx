import React from 'react';
import './EmptyTrendChart.css';

export default function EmptyTrendChart({ labels = [], points = [], tone = 'green' }) {
  const strokeClass = `empty-trend-chart__path--${tone}`;

  return (
    <div className="empty-trend-chart" role="img" aria-label="Empty trend chart placeholder">
      <div className="empty-trend-chart__badge">No data yet</div>
      <div className="empty-trend-chart__grid">
        <span />
        <span />
        <span />
        <span />
      </div>
      <svg
        className="empty-trend-chart__svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polyline
          className={`empty-trend-chart__path ${strokeClass}`}
          points={points.join(' ')}
        />
      </svg>
      <div className="empty-trend-chart__labels">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}
