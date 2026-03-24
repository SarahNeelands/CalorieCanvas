import React from "react";
import "../components/calories/RecentMeals.css";
import { listMealLogs } from "../services/mealLogClient";

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

export default function RecentMealsLogged({ userId, limit = 3, title = "Recent Meals" }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

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

  React.useEffect(() => { refetch(); }, [refetch]);

  React.useEffect(() => {
    const handler = () => refetch();
    window.addEventListener("meal-logged", handler);
    return () => window.removeEventListener("meal-logged", handler);
  }, [refetch]);

  return (
    <section className="recent-meals">
      <h3 className="recent-meals__title">{title}</h3>
      {loading && <div style={{ padding: "0.5rem 0" }}>Loading…</div>}
      {error && <div style={{ color: "#b00020" }}>Failed to load: {String(error.message || error)}</div>}
      {!loading && !rows.length && <div>No recent meals yet.</div>}
      <div className="list">
        {rows.map((r) => (
          <div key={r.id} className="item">
            <div className="item__content item__content--padded">
              <div className="item__left">
                <div className="meal-row">
                  <h4 className="item__title" style={{ margin: 0 }}>{r.meal?.title || "Meal"}</h4>
                  <p className="item__time" style={{ margin: 0 }}>{formatDateTime(r.logged_at)}</p>
                </div>
                <div style={{ fontSize: "0.9rem", color: "#444", marginTop: 4 }}>
                  {r.qty} {r.unit_code}{r.unit_code === "quantity" ? (r.qty === 1 ? "" : " items") : ""}
                  {Number(r.grams_resolved) ? ` · ${Number(r.grams_resolved)} g` : ""}
                </div>
              </div>
              <div className="kcal">
                {Number(r.kcal || 0)} <span>kcal</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
