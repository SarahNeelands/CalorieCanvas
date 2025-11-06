import React from "react";
import "../calories/RecentMeals.css";
import vine1 from "../images/vines/vine1.png";
import vine2 from "../images/vines/vine2.png";
import vine3 from "../images/vines/vine3.png";
import vine4 from "../images/vines/vine4.png";
import vine5 from "../images/vines/vine5.png";
import vine6 from "../images/vines/vine6.png";

const VINES = [vine1, vine2, vine3, vine4, vine5, vine6];

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

export default function MealCard({ item, onClick }) {
  const { title, created_at, kcal_per_100g } = item;
  return (
    <button className="item" onClick={() => onClick?.(item)} style={{ textAlign: "left", cursor: "pointer", border: "none", background: "transparent", padding: 0 }}>
      {VINES.map((src, j) => (
        <img key={j} src={src} alt="" className={`vine vine--${j + 1}`} />
      ))}
      <div className="item__content" style={{ padding: "0.75rem 1.75rem 0.75rem" }}>
        <div className="item__left">
          <div className="meal-row">
            <h4 className="item__title" style={{ margin: 0 }}>{title}</h4>
            <p className="item__time" style={{ margin: 0 }}>{formatDateTime(created_at)}</p>
          </div>
        </div>
        <div className="kcal">
          {Number(kcal_per_100g ?? 0)} <span>kcal / 100g</span>
        </div>
      </div>
    </button>
  );
}
