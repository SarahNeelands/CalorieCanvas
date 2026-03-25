import React from "react";
import "./CalorieSummary.css";

export default function CalorieSummary({ goal, eaten }) {
  const hasGoal = Number.isFinite(goal) && goal > 0;
  const left = hasGoal ? goal - eaten : null;
  const pct = hasGoal ? Math.max(0, Math.min(100, (eaten / goal) * 100)) : 0;

  return (
    <section className="summary-card">
      <div className="summary-grid">
        <h1 className="cc-page-title">Today's Canvas</h1>
        <p className="summary-subtitle cc-page-subtitle">Your daily calorie summary.</p>
      </div>

      <div className="progress-bar">
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="summary-left-row">
        <span className="kcal-left">{hasGoal ? left : "--"}</span>
        <span className="unit">{hasGoal ? "kcal left" : "goal unavailable"}</span>
      </div>

      <div className="summary-stats">
        <span>Goal: {hasGoal ? `${goal} kcal` : "Unavailable"}</span>
        <span>{eaten} kcal eaten</span>
      </div>
    </section>
  );
}
