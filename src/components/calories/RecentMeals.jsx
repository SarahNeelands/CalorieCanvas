import React from "react";
import "./RecentMeals.css";
import vine1 from "../images/vines/vine1.png";
import vine2 from "../images/vines/vine2.png";
import vine3 from "../images/vines/vine3.png";
import vine4 from "../images/vines/vine4.png";
import vine5 from "../images/vines/vine5.png";
import vine6 from "../images/vines/vine6.png";

const VINES = [vine1, vine2, vine3, vine4, vine5, vine6];

export default function RecentMeals({ meals = [] }) {
  const top3 = meals.slice(0, 3);

  return (
    <section className="recent-meals">
      <h3 className="recent-meals__title">Recent Meals</h3>

      <div className="list">
        {top3.map((m, i) => (
          <div key={i} className="item">
            {/* vines per item */}
            {VINES.map((src, j) => (
              <img key={j} src={src} alt="" className={`vine vine--${j + 1}`} />
            ))}

            <div className="item__content">
              <div className="item__left">
                <div className="meal-row">
                  <div className="item__title">{m.title}</div>
                  <div className="item__time">{m.time}</div>
                </div>
              </div>

              <div className="kcal">
                {m.kcal} <span>kcal</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
