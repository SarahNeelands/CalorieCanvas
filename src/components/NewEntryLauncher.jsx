import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import addIcon from "./images/addIcon.png";
import "./NewEntryLauncher.css";

export default function NewEntryLauncher() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  function go(path) {
    setOpen(false);
    navigate(path);
  }

  function openGuestimate() {
    setOpen(false);
    navigate("/meals", { state: { openGuestimateMeal: true } });
  }

  return (
    <div className="new-entry-launcher">
      <button
        type="button"
        className="new-entry-launcher__button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Create new entry"
      >
        <img src={addIcon} alt="" className="new-entry-launcher__icon" />
      </button>

      {open && (
        <div className="new-entry-launcher__popover">
          <button type="button" onClick={() => go("/meals/new")} aria-label="New meal">
            Meal
          </button>
          <button type="button" onClick={() => go("/snacks/new")} aria-label="New snack">
            Snack
          </button>
          <button type="button" onClick={openGuestimate} aria-label="Guestimate meal">
            Guestimate
          </button>
        </div>
      )}
    </div>
  );
}
