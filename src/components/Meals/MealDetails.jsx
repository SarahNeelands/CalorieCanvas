/**
 * Collects meal name, timestamp (autofilled), and total weight.
 * Emits weight live via onTotalWeightChange for the Summary pane.
 */
import React, { useEffect, useState } from "react";
import "./MealDetails.css";

export default function MealDetails({ onTotalWeightChange }) {
  const [mealName, setMealName] = useState("");
  const [timestamp, setTimestamp] = useState("");
  const [totalWeight, setTotalWeight] = useState("");

  useEffect(() => {
    const now = new Date();
    // yyyy-MM-ddTHH:mm (local)
    const pad = (n) => String(n).padStart(2, "0");
    const ts = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setTimestamp(ts);
  }, []);

  useEffect(() => {
    const v = Number(totalWeight || 0);
    onTotalWeightChange?.(isNaN(v) ? 0 : v);
  }, [totalWeight, onTotalWeightChange]);

  return (
    <div className="md-root">
      <h2 className="md-title">Meal Details</h2>

      <label className="md-field">
        <span>Meal Name</span>
        <input
          type="text"
          placeholder="e.g., Post-Workout Smoothie"
          value={mealName}
          onChange={(e) => setMealName(e.target.value)}
        />
      </label>

      <label className="md-field">
        <span>Timestamp</span>
        <input
          type="datetime-local"
          value={timestamp}
          onChange={(e) => setTimestamp(e.target.value)}
        />
      </label>

      <label className="md-field">
        <span>Total Weight (g)</span>
        <input
          type="number"
          inputMode="decimal"
          placeholder="e.g., 350"
          value={totalWeight}
          onChange={(e) => setTotalWeight(e.target.value)}
        />
      </label>
    </div>
  );
}
