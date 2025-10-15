import React from "react";
import { Link } from "react-router-dom";

export default function QuickActions() {
  return (
    <aside className="cc-frame">
      <h3 style={{ fontWeight: 800, fontSize: "1.25rem", marginBottom: 12 }}>Quick Actions</h3>
      <div style={{ display: "grid", gap: 14 }}>
        <Link to="/meals/log" className="cc-btn cc-btn-solid text-center">Log Meal</Link>
        <Link to="/exercises/log" className="cc-btn cc-btn-soft text-center">Log Exercise</Link>
      </div>
    </aside>
  );
}
