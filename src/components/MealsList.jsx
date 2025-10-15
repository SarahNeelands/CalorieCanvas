/**
 * MealsList.jsx
 * Lists saved meals with name, kcal/100g, created date, and a "Log" button.
 * "Log" opens a modal to capture weight + timestamp, then calls onAddLog.
 * Replace mock data and onAddLog with real DB calls.
 */
import React, { useMemo, useState } from "react";
import LogMealEntryModal from "./LogMealEntryModal.jsx";

const MOCK_MEALS = [
  { id: "m1", name: "Pasta Primavera", kcalPer100g: 120, createdAt: new Date().toISOString() },
  { id: "m2", name: "Chicken Salad",    kcalPer100g: 95,  createdAt: new Date().toISOString() },
];

export default function MealsList({ onAddLog }) {
  const [openFor, setOpenFor] = useState(null); // meal object or null

  const rows = useMemo(() => MOCK_MEALS, []);

  const handleAdded = (payload) => {
    // TODO: Persist meal log to user diary
    // payload = { mealId, weight, timestamp }
    onAddLog?.(payload);
    setOpenFor(null);
  };

  return (
    <div className="card">
      <div className="table">
        <div className="thead">
          <div>Name</div>
          <div>kcal / 100g</div>
          <div>Added</div>
          <div></div>
        </div>
        {rows.map((m) => (
          <div className="trow" key={m.id}>
            <div>{m.name}</div>
            <div>{Math.round(m.kcalPer100g)}</div>
            <div>{new Date(m.createdAt).toLocaleString()}</div>
            <div>
              <button onClick={() => setOpenFor(m)}>Log</button>
            </div>
          </div>
        ))}
      </div>

      {openFor && (
        <LogMealEntryModal
          meal={openFor}
          onCancel={() => setOpenFor(null)}
          onAdd={handleAdded}
        />
      )}
    </div>
  );
}
