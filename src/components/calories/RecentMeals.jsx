import React from "react";

import "./RecentMeals.css";
import vineFrame from "../images/Frame.png";

export default function RecentMeals({ meals = [] }) {
  const top3 = meals.slice(0, 3);

  return (
    <section>
      <h3 style={{ fontWeight: 800, fontSize: "1.25rem", marginBottom: 12 }}>Recent Meals</h3>
      <div className="list">
        {top3.map(m => (
          <div className="item item--framed">
            <div className="item__content">
              <div>
                <div style={{ fontWeight: 800 }}>{m.title}</div>
                <div className="sub" style={{ fontSize: 14 }}>{m.time}</div>
              </div>
              <div className="kcal">
                {m.kcal} <span style={{ fontWeight: 600 }}>kcal</span>
              </div>
            </div>
          </div>

        ))}
      </div>
    </section>
  );
}
