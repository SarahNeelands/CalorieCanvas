import React from 'react';
import Card from '../ui/Card.jsx';
import './TrendCard.css';

export default function TrendCard({
  title,
  subtitle,
  averageText,
  summaryLabel = 'Average',
  actions,
  children,
  className = '',
}) {
  return (
    <Card className={`progress-trend-card ${className}`.trim()}>
      <div className="trend-card__header">
        <div>
          <h3 className="trend-card__title">{title}</h3>
          {subtitle ? <p className="trend-card__subtitle">{subtitle}</p> : null}
        </div>
        <div className="trend-card__side">
          {actions ? <div className="trend-card__actions">{actions}</div> : null}
          {averageText ? (
            <div className="trend-card__average">
              <div className="trend-card__average-label">{summaryLabel}</div>
              <div className="trend-card__average-value">{averageText}</div>
            </div>
          ) : null}
        </div>
      </div>
      {children}
    </Card>
  );
}
