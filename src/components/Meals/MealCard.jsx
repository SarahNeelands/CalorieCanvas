import React from "react";
import "../calories/RecentMeals.css";

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

export default function MealCard({ item, onClick, onEdit, onDelete }) {
  const { title, created_at, kcal_per_100g } = item;
  return (
    <div className="item">
      <button
        type="button"
        className="item__click"
        onClick={() => onClick?.(item)}
        style={{ textAlign: "left", cursor: "pointer", border: "none", background: "transparent", padding: 0 }}
      >
        <div className="item__content item__content--padded">
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
      {(onEdit || onDelete) && (
        <div className="item__actions">
          {onEdit && (
            <button
              type="button"
              className="item__action-btn"
              onClick={() => onEdit(item)}
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="item__action-btn item__action-btn--danger"
              onClick={() => onDelete(item)}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
