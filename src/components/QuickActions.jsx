import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./QuickActions.css";
import quickActionFrame from "./images/QuickActionFrame.png"; // background frame
import addIcon from "./images/addIcon.png";

export default function QuickActions() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onDoc(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setOpen(false);
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
          <Link to="/meals/log" className="btn btn-solid text-center">
            Log Meal
          </Link>
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
