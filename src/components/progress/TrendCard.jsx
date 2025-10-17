import React from 'react';
import Card from '../ui/Card.jsx';

export default function TrendCard({ title, subtitle, averageText, children }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold">{title}</h3>
          {subtitle ? <p className="text-sm opacity-70">{subtitle}</p> : null}
        </div>
        {averageText ? (
          <div className="text-right">
            <div className="text-sm opacity-70">Average</div>
            <div className="text-lg font-medium">{averageText}</div>
          </div>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

