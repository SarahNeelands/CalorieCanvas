/**
 * Collects meal name, timestamp (autofilled), and total weight.
 * Emits weight live via onTotalWeightChange for the Summary pane.
 */
import React, { useEffect, useState } from "react";
import "./MealDetails.css";

export default function MealDetails({
  mealName,
  timestamp,
  totalWeight,
  servingCount,
  onMealNameChange,
  onTimestampChange,
  onTotalWeightChange,
  onServingCountChange,
}) {
  const [initialTimestamp, setInitialTimestamp] = useState("");

  useEffect(() => {
    if (timestamp) return;
    const now = new Date();
    // yyyy-MM-ddTHH:mm (local)
    const pad = (n) => String(n).padStart(2, "0");
    const ts = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setInitialTimestamp(ts);
    onTimestampChange?.(ts);
  }, [onTimestampChange, timestamp]);

  return (
    <div className="md-root">
      <h2 className="md-title">Meal Details</h2>

      <label className="md-field">
        <span>Meal Name</span>
        <input
          type="text"
          placeholder="e.g., Post-Workout Smoothie"
          value={mealName}
          onChange={(e) => onMealNameChange?.(e.target.value)}
        />
      </label>

      <label className="md-field">
        <span>Timestamp</span>
        <input
          type="datetime-local"
          value={timestamp || initialTimestamp}
          onChange={(e) => onTimestampChange?.(e.target.value)}
        />
      </label>

      <label className="md-field">
        <span>Total Weight (g)</span>
        <input
          type="number"
          inputMode="decimal"
          placeholder="e.g., 350"
          value={totalWeight}
          onChange={(e) => onTotalWeightChange?.(e.target.value)}
        />
      </label>

      <label className="md-field">
        <span>Servings (optional)</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          placeholder="e.g., 4"
          value={servingCount}
          onChange={(e) => onServingCountChange?.(e.target.value)}
        />
      </label>
    </div>
  );
}
