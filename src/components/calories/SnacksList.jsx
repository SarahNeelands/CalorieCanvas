/**
 * SnacksList.jsx
 * Lists saved snacks with name, kcal/100g or kcal/unit, created date, and a "Log" button.
 * Logging allows choosing between Weight (g) or Quantity (units).
 */
import React, { useMemo, useState } from "react";
import LogSnackEntryModal from "./LogSnackEntryModal.jsx";

const MOCK_SNACKS = [
  { id: "s1", name: "Greek Yogurt", kcalPer100g: 59, createdAt: new Date().toISOString() },
  { id: "s2", name: "Protein Bar",  kcalPerUnit: 210, createdAt: new Date().toISOString() },
];

export default function SnacksList({ onAddLog }) {
  const [openFor, setOpenFor] = useState(null);
  const rows = useMemo(() => MOCK_SNACKS, []);

  const handleAdded = (payload) => {
    // payload: { snackId, mode: 'weight'|'quantity', amount, timestamp }
    onAddLog?.(payload);
    setOpenFor(null);
  };

  return (
    <div className="card">
      <div className="table">
        <div className="thead">
          <div>Name</div>
          <div>Energy ref</div>
          <div>Added</div>
          <div></div>
        </div>
        {rows.map((s) => (
          <div className="trow" key={s.id}>
            <div>{s.name}</div>
            <div>
              {s.kcalPer100g ? `${s.kcalPer100g} / 100g` : `${s.kcalPerUnit} / unit`}
            </div>
            <div>{new Date(s.createdAt).toLocaleString()}</div>
            <div>
              <button onClick={() => setOpenFor(s)}>Log</button>
            </div>
          </div>
        ))}
      </div>

      {openFor && (
        <LogSnackEntryModal
          snack={openFor}
          onCancel={() => setOpenFor(null)}
          onAdd={handleAdded}
        />
      )}
    </div>
  );
}
