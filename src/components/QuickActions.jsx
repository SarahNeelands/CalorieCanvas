import React from "react";
import { Link } from "react-router-dom";
import "./QuickActions.css";
import quickActionFrame from "./images/QuickActionFrame.png"; // <-- adjust path to where the file really is

export default function QuickActions() {
  return (
    <aside className="frame">
      {/* background frame image */}
      <img
        src={quickActionFrame}
        alt=""
        className="frame-bg"
        aria-hidden="true"
      />

      {/* content */}
      <h3 className="frame-title">Quick Actions</h3>
      <div className="btn-container">
        <Link to="/meals/log" className="btn btn-solid text-center">
          Log Meal
        </Link>
        <Link to="/exercises/log" className="btn btn-soft text-center">
          Log Exercise
        </Link>
      </div>
    </aside>
  );
}
