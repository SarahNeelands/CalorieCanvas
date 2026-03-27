import React from "react";
import MealCard from "./MealCard.jsx";
import "../calories/RecentMeals.css";
import { deleteCatalogItem, getCachedCatalogItems, listCatalogItems } from "../../services/catalogClient";

export default function MealsList({
  userId,
  onLogClick,
  onEditClick,
  title = "All Meals",
  headerAction = null,
}) {
  const [rows, setRows] = React.useState(() => getCachedCatalogItems("meal", userId));
  const [loading, setLoading] = React.useState(rows.length === 0);
  const [error, setError] = React.useState(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let alive = true;

    async function load() {
      try {
        if (!rows.length) {
          setLoading(true);
        }
        setError(null);
        if (!userId) throw new Error("Missing user ID");
        const data = await listCatalogItems("meal");
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
  }, [userId, reloadKey, rows.length]);

  async function handleDelete(item) {
    const confirmed = window.confirm(`Delete "${item.title}"?`);
    if (!confirmed) return;

    try {
      setError(null);
      await deleteCatalogItem(item.id);
      setRows((current) => current.filter((row) => row.id !== item.id));
      setReloadKey((value) => value + 1);
    } catch (e) {
      setError(e);
    }
  }

  return (
    <section className="recent-meals recent-meals--catalog">
      <div className="recent-meals__header">
        <h3 className="recent-meals__title">{title}</h3>
        {headerAction}
      </div>
      {loading && <div style={{ padding: "0.5rem 0" }}>Loading...</div>}
      {error && <div style={{ color: "#b00020", padding: "0.5rem 0" }}>Failed to load meals: {String(error.message || error)}</div>}
      {!loading && !rows?.length && <div style={{ padding: "0.5rem 0" }}>No meals yet. Add your first one!</div>}
      <div className="list">
        {rows?.map((m) => (
          <MealCard
            key={m.id}
            item={m}
            onClick={onLogClick}
            onEdit={onEditClick}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </section>
  );
}
