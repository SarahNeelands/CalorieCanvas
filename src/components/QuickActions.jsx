import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./QuickActions.css";
import quickActionFrame from "./images/QuickActionFrame.png"; // background frame

export default function QuickActions() {
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onDoc(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) return;
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  return (
    <aside className="frame quick-actions">
      {/* background frame image */}
      <img
        src={quickActionFrame}
        alt=""
        className="frame-bg"
        aria-hidden="true"
      />

      {/* DESKTOP / TABLET: original quick actions (hidden on narrow phones) */}
      <div className="qa-desktop">
        <h3 className="frame-title">Quick Actions</h3>
        <div className="btn-container">
          <button className="btn btn-soft text-center" onClick={() => navigate('/meals/log')}>
            Log Meal
          </button>
          <button className="btn btn-soft text-center" onClick={() => navigate('/exercises', { state: { openLog: true } })}>
            Log Exercise
          </button>
          <button className="btn btn-soft text-center" onClick={() => navigate('/progress', { state: { openWeight: true } })}>
            Log Weight
          </button>
        </div>
      </div>
    </aside>
  );
}
