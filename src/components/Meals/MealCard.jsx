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
          <div className="item__main">
            <div className="item__top-row">
              <h4 className="item__title" style={{ margin: 0 }}>{title}</h4>
              <div className="kcal">
                {Number(kcal_per_100g ?? 0)} <span>kcal / 100g</span>
              </div>
            </div>
            <div className="item__bottom-row">
              <p className="item__time" style={{ margin: 0 }}>{formatDateTime(created_at)}</p>
              {(onEdit || onDelete) && (
                <div className="item__actions item__actions--inline">
                  {onEdit && (
                    <button
                      type="button"
                      className="item__action-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(item);
                      }}
                    >
                      Edit
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      className="item__action-btn item__action-btn--danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(item);
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}
