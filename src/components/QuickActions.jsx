import React from "react";
import { Link } from "react-router-dom";
import "./QuickActions.css";



export default function QuickActions() {
  return (
    <aside className="frame">
      <h3 style={{ fontWeight: 800, fontSize: "1.25rem", marginBottom: 12 }}>Quick Actions</h3>
      <div style={{ display: "grid", gap: 14 }}>
        <Link to="/meals/log" className="btn btn-solid text-center">Log Meal</Link>
        <Link to="/exercises/log" className="btn btn-soft text-center">Log Exercise</Link>
      </div>
    </aside>
  );
}
