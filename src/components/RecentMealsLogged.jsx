import React from "react";
import LogMealModal from "./Meals/LogMealModal.jsx";
import "../components/calories/RecentMeals.css";
import { deleteMealLog, listMealLogs } from "../services/mealLogClient";

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
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

export default function RecentMealsLogged({ userId, limit = 3, title = "Recent Meals" }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [editingRow, setEditingRow] = React.useState(null);

  const refetch = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (!userId) throw new Error("Missing user ID");
      const data = await listMealLogs({ userId, limit });
      setRows(data ?? []);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [userId, limit]);

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

  return (
    <section className="recent-meals">
      <h3 className="recent-meals__title">{title}</h3>
      {loading && <div style={{ padding: "0.5rem 0" }}>Loading...</div>}
      {error && <div style={{ color: "#b00020" }}>Failed to load: {String(error.message || error)}</div>}
      {!loading && !rows.length && <div>No recent meals yet.</div>}
      <div className="list">
        {rows.map((r) => (
          <div key={r.id} className="item">
            <div className="item__content item__content--padded">
              <div className="item__left">
                <div className="meal-row">
                  <h4 className="item__title" style={{ margin: 0 }}>{getDisplayTitle(r)}</h4>
                  <p className="item__time" style={{ margin: 0 }}>{formatDateTime(r.logged_at)}</p>
                </div>
                {getDisplayBrand(r) && (
                  <div className="item__meta item__meta--brand">{getDisplayBrand(r)}</div>
                )}
                <div className="item__meta">{getDisplayAmount(r)}</div>
              </div>
              <div className="item__right">
                <div className="kcal">
                  {Number(r.kcal || 0)} <span>kcal</span>
                </div>
                <div className="item__actions--inline">
                  <button type="button" className="item__quick-btn item__quick-btn--soft" onClick={() => setEditingRow(r)}>Edit</button>
                  <button type="button" className="item__quick-btn item__quick-btn--soft" onClick={() => handleDelete(r)}>Delete</button>
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
