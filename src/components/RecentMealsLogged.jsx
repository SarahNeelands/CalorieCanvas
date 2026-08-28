import React from "react";
import LogMealModal from "./Meals/LogMealModal.jsx";
import "../components/calories/RecentMeals.css";
import { deleteMealLog, getMealLogDay } from "../services/mealLogClient";

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getDisplayTitle(row) {
  return row.meal?.title || "Meal";
}

function getDisplayBrand(row) {
  if (row.meal?.type !== "snack") return "";
  return row.meal?.unit_conversions?.brand?.trim?.() || "";
}

function getDisplayAmount(row) {
  const quantityLabel = row.meal?.unit_conversions?.quantity_label?.trim?.() || "";

  if (row.unit_code === "quantity" && quantityLabel) {
    return `${row.qty} ${quantityLabel}${Number(row.qty) === 1 ? "" : "s"}`;
  }

  if (Number(row.grams_resolved)) {
    return `${Number(row.grams_resolved)} g`;
  }

  return `${row.qty} ${row.unit_code}`;
}

function flattenMealLogDay(day) {
  return (day?.meals || []).flatMap((section) => section.entries || []);
}

function getGroupKey(row) {
  const meal = row.meal || {};
  const identity = row.meal_id || meal.id || `${meal.type || meal.item_type || "meal"}:${getDisplayTitle(row).toLowerCase()}`;
  return `${row.log_date || ""}:${identity}`;
}

export function groupMealLogsForRecent(rows = []) {
  const groups = new Map();

  for (const row of rows) {
    const key = getGroupKey(row);
    const current = groups.get(key) || {
      key,
      title: getDisplayTitle(row),
      brand: getDisplayBrand(row),
      latestLoggedAt: row.logged_at,
      totalKcal: 0,
      entries: [],
    };

    current.entries.push(row);
    current.totalKcal += Number(row.kcal || 0);
    if (!current.latestLoggedAt || Date.parse(row.logged_at) > Date.parse(current.latestLoggedAt)) {
      current.latestLoggedAt = row.logged_at;
    }
    groups.set(key, current);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      entries: group.entries.sort((a, b) => Date.parse(b.logged_at) - Date.parse(a.logged_at)),
    }))
    .sort((a, b) => Date.parse(b.latestLoggedAt) - Date.parse(a.latestLoggedAt));
}

export default function RecentMealsLogged({ userId, title = "Recent Meals" }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [editingRow, setEditingRow] = React.useState(null);

  const refetch = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (!userId) throw new Error("Missing user ID");
      const day = await getMealLogDay({ userId });
      setRows(flattenMealLogDay(day));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    refetch();
  }, [refetch]);

  React.useEffect(() => {
    const handler = () => refetch();
    window.addEventListener("meal-logged", handler);
    return () => window.removeEventListener("meal-logged", handler);
  }, [refetch]);

  async function handleDelete(row) {
    try {
      setError(null);
      await deleteMealLog(row.id, userId);
      window.dispatchEvent(new CustomEvent("meal-logged", { detail: { deletedId: row.id } }));
    } catch (e) {
      setError(e);
    }
  }

  const groups = groupMealLogsForRecent(rows);

  return (
    <section className="recent-meals">
      <h3 className="recent-meals__title">{title}</h3>
      {loading && <div style={{ padding: "0.5rem 0" }}>Loading...</div>}
      {error && <div style={{ color: "#b00020" }}>Failed to load: {String(error.message || error)}</div>}
      {!loading && !rows.length && <div>No meals logged today.</div>}
      <div className="list">
        {groups.map((group) => (
          <div key={group.key} className="item">
            <div className="item__content item__content--padded">
              <div className="item__left">
                <div className="meal-row">
                  <h4 className="item__title" style={{ margin: 0 }}>{group.title}</h4>
                  <p className="item__time" style={{ margin: 0 }}>{formatDate(group.latestLoggedAt)}</p>
                </div>
                {group.brand && (
                  <div className="item__meta item__meta--brand">{group.brand}</div>
                )}
                <div className="recent-meals__entries">
                  {group.entries.map((entry) => (
                    <div className="recent-meals__entry" key={entry.id}>
                      <div className="recent-meals__entry-main">
                        <span className="item__time">{formatTime(entry.logged_at)}</span>
                        <span className="item__meta">{getDisplayAmount(entry)}</span>
                        <span className="recent-meals__entry-kcal">{Number(entry.kcal || 0)} kcal</span>
                      </div>
                      <div className="item__actions--inline">
                        <button type="button" className="item__quick-btn item__quick-btn--soft" onClick={() => setEditingRow(entry)}>Edit</button>
                        <button type="button" className="item__quick-btn item__quick-btn--soft" onClick={() => handleDelete(entry)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="item__right">
                <div className="kcal">
                  {Number(group.totalKcal.toFixed(2))} <span>kcal</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <LogMealModal
        open={Boolean(editingRow)}
        onClose={() => setEditingRow(null)}
        userId={userId}
        item={editingRow?.meal || null}
        existingEntry={editingRow}
        redirectAfterSave={false}
        onSaved={() => {
          setEditingRow(null);
          void refetch();
        }}
      />
    </section>
  );
}
