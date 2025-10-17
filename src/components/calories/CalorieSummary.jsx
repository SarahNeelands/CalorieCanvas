import React from "react";

export default function CalorieSummary({ goal, eaten }) {
  const left = Math.max(0, goal - eaten);
  const pct  = Math.max(0, Math.min(100, (eaten / goal) * 100));

  return (
    <section className="cc-card" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h2 className="cc-h2">Today’s Canvas</h2>
          <p className="cc-sub">Your daily calorie summary.</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "2.75rem", fontWeight: 900, lineHeight: 1 }}>{left}</div>
          <div className="cc-sub">kcal left</div>
        </div>
      </div>

      <div className="cc-spaced">
        <div className="cc-progress">
          <div className="track" />
          <div className="fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="cc-mutedrow" style={{ marginTop: 8 }}>
          <span>Goal: {goal} kcal</span>
          <span>{eaten} kcal eaten</span>
        </div>
      </div>
    </section>
  );
}
