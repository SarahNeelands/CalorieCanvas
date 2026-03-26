import React from "react";
import MealCard from "./MealCard.jsx";
import "../calories/RecentMeals.css";
import { getCachedCatalogItems, listCatalogItems } from "../../services/catalogClient";

export default function SnacksList({
  userId,
  onLogClick,
  title = "All Snacks",
  headerAction = null,
}) {
  const [rows, setRows] = React.useState(() => getCachedCatalogItems("snack", userId));
  const [loading, setLoading] = React.useState(rows.length === 0);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let alive = true;

    async function load() {
      try {
        if (!rows.length) {
          setLoading(true);
        }
        setError(null);
        if (!userId) throw new Error("Missing user ID");
        const data = await listCatalogItems("snack");
        if (!alive) return;
        setRows(data ?? []);
      } catch (e) {
        if (!alive) return;
        setError(e);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [userId, rows.length]);

  return (
    <section className="recent-meals">
      <div className="recent-meals__header">
        <h3 className="recent-meals__title">{title}</h3>
        {headerAction}
      </div>
      {loading && <div style={{ padding: "0.5rem 0" }}>Loading...</div>}
      {error && <div style={{ color: "#b00020", padding: "0.5rem 0" }}>Failed to load snacks: {String(error.message || error)}</div>}
      {!loading && !rows?.length && <div style={{ padding: "0.5rem 0" }}>No snacks yet. Add your first one!</div>}
      <div className="list">
        {rows?.map((m) => (
          <MealCard key={m.id} item={m} onClick={onLogClick} />
        ))}
      </div>
    </section>
  );
}
