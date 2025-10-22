import React from "react";

import "./RecentMeals.css";


export default function RecentMeals({ meals = [] }) {
  const top3 = meals.slice(0, 3);

  return (
    <section>
      <h3 style={{ fontWeight: 800, fontSize: "1.25rem", marginBottom: 12 }}>Recent Meals</h3>
      <div className="list">
        {top3.map(m => (
          <div key={m.id} className="item">
            <div>
              <div style={{ fontWeight: 800 }}>{m.title}</div>
              <div className="sub" style={{ fontSize: 14 }}>{m.time}</div>
            </div>
            <div className="kcal">
              {m.kcal} <span style={{ fontWeight: 600 }}>kcal</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
