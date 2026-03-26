/**
 * LogSnackEntryModal.jsx
 * Modal to log a SNACK entry. User can choose:
 *  - Weight (grams)
 *  - Quantity (units)
 * Emits onAdd({ snackId, mode, amount, timestamp }).
 */
import React, { useEffect, useState } from "react";

export default function LogSnackEntryModal({ snack, onCancel, onAdd }) {
  const [mode, setMode] = useState("weight"); // 'weight' | 'quantity'
  const [amount, setAmount] = useState("");
  const [timestamp, setTimestamp] = useState("");

  useEffect(() => {
    setTimestamp(new Date().toISOString().slice(0, 16));
  }, []);

  const add = () => {
    const val = Number(amount);
    if (!val || val <= 0) return alert("Enter a valid amount.");
    onAdd?.({ snackId: snack.id, mode, amount: val, timestamp });
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <header className="row-between">
          <h3>Log Snack: {snack.name}</h3>
          <button onClick={onCancel} aria-label="Close">✕</button>
        </header>

        <div className="row gap-12">
          <label className="row gap-6">
            <input
              type="radio"
              name="mode"
              value="weight"
              checked={mode === "weight"}
              onChange={() => setMode("weight")}
            />
            Weight (g)
          </label>
          <label className="row gap-6">
            <input
              type="radio"
              name="mode"
              value="quantity"
              checked={mode === "quantity"}
              onChange={() => setMode("quantity")}
            />
            Quantity (units)
          </label>
        </div>

        <label>
          {mode === "weight" ? "Weight (g)" : "Quantity"}
          <input
            type="number"
            min="1"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
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
