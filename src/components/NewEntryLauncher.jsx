/**
 * NewEntryLauncher.jsx
 * Small launcher button for creating a new Meal or Snack.
 * Clicking shows a chooser; routes to the appropriate creation page.
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function NewEntryLauncher() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)}>New</button>
      {open && (
        <div className="popover">
          <button onClick={() => go("/meals/new")} aria-label="New meal">Meal</button>
          <button onClick={() => go("/snacks/new")} aria-label="New snack">Snack</button>
        </div>
      )}
    </div>
  );
}
