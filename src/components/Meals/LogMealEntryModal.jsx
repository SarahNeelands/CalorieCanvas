/**
 * LogMealEntryModal.jsx
 * Modal to log a MEAL entry with weight (g) and editable timestamp.
 * Calls onAdd({ mealId, weight, timestamp }) on confirm.
 */
import React, { useEffect, useState } from "react";

export default function LogMealEntryModal({ meal, onCancel, onAdd }) {
  const [weight, setWeight] = useState("");
  const [timestamp, setTimestamp] = useState("");

  useEffect(() => {
    const now = new Date();
    setTimestamp(now.toISOString().slice(0, 16)); // YYYY-MM-DDTHH:mm
  }, []);

  const add = () => {
    const w = Number(weight);
    if (!w || w <= 0) return alert("Enter a weight in grams.");
    onAdd?.({ mealId: meal.id, weight: w, timestamp });
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <header className="row-between">
          <h3>Log Meal: {meal.name}</h3>
          <button onClick={onCancel} aria-label="Close">✕</button>
        </header>

        <label>
          Weight (g)
          <input
            type="number"
            min="1"
            inputMode="numeric"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </label>

        <label>
          Time
          <input
            type="datetime-local"
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
          />
        </label>

        <footer className="row-end gap-8">
          <button className="secondary" onClick={onCancel}>Cancel</button>
          <button onClick={add}>Add</button>
        </footer>
      </div>
    </div>
  );
}
