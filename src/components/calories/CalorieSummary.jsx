// src/components/calories/CalorieSummary.jsx
import React from 'react';
import './CalorieSummary.css';

export default function CalorieSummary({ goal, eaten }) {
  const left = goal - eaten;
  const pct = (eaten / goal) * 100;

  return (
    <section className="summary-card">
      <div className="summary-grid">
        <h1>Today’s Canvas</h1>
        <span className="kcal-left">{left}</span>
        <p className="summary-subtitle">Your daily calorie summary.</p>
        <span className="unit">kcal left</span>
      </div>

      <div className="progress-bar">
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="summary-stats">
        <span>Goal: {goal} kcal</span>
        <span>{eaten} kcal eaten</span>
      </div>
    </section>
  );
}
