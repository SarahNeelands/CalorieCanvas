import React from "react";
import { supabase } from "../../supabaseClient";
import MealCard from "./MealCard.jsx";
import "../calories/RecentMeals.css";

export default function SnacksList({ userId, onLogClick }) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [rows, setRows] = React.useState([]);

  React.useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        if (!userId) throw new Error("Missing user ID");
        const { data, error } = await supabase
          .from("meals")
          .select("id, user_id, title, type, created_at, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, unit_conversions, food_id")
          .eq("user_id", userId)
          .eq("type", "snack")
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
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
    return () => { alive = false; };
  }, [userId]);

  return (
    <section className="recent-meals">
      <h3 className="recent-meals__title">All Snacks</h3>
      {loading && <div style={{ padding: "0.5rem 0" }}>Loading…</div>}
      {error && <div style={{ color: "#b00020", padding: "0.5rem 0" }}>Failed to load snacks: {String(error.message || error)}</div>}
      {!loading && !rows?.length && <div style={{ padding: "0.5rem 0" }}>No snacks yet. Add your first one!</div>}
      <div className="list">
        {rows?.map((m) => (<MealCard key={m.id} item={m} onClick={onLogClick} />))}
      </div>
    </section>
  );
}
