import React from "react";

export default function RecentMeals({ meals = [] }) {
  const top3 = meals.slice(0, 3);

  return (
    <section>
      <h3 style={{ fontWeight: 800, fontSize: "1.25rem", marginBottom: 12 }}>Recent Meals</h3>
      <div className="cc-list">
        {top3.map(m => (
          <div key={m.id} className="cc-item">
            <div>
              <div style={{ fontWeight: 800 }}>{m.title}</div>
              <div className="cc-sub" style={{ fontSize: 14 }}>{m.time}</div>
            </div>
            <div className="cc-kcal">
              {m.kcal} <span style={{ fontWeight: 600 }}>kcal</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
