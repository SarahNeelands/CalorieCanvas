/**
 * Right-hand summary card: list items + total & actions.
 */
import React from "react";
import "./MealSummary.css";

export default function MealSummary({ ingredients, totalWeight }) {
  const totalCalories = ingredients.reduce((sum, ing) => sum + (ing.calories || 0), 0);
  const per100g = totalWeight ? (totalCalories / totalWeight) * 100 : 0;

  const save = () => {
    // hook your saveMeal here if desired
    alert("Saved (wire your DB here)");
  };

  return (
    <div className="ms-root">
      <h3 className="ms-title">Current Meal</h3>

      <ul className="ms-items">
        {ingredients.map((ing, i) => (
          <li key={`${ing.id ?? ing.name}-${i}`}>
            <div className="name">{ing.name}</div>
            <div className="meta">{Math.round(ing.calories)} kcal</div>
          </li>
        ))}
        {ingredients.length === 0 && (
          <li className="ms-empty">No items yet.</li>
        )}
      </ul>

      <div className="ms-totals">
        <div className="label">Total Calories:</div>
        <div className="value">{Math.round(totalCalories)}</div>
        <div className="sub">kcal</div>
      </div>

      <div className="ms-meta">
        <div>Weight: <strong>{totalWeight || 0} g</strong></div>
        <div>Per 100g: <strong>{per100g.toFixed(1)} kcal</strong></div>
      </div>

      <div className="ms-actions">
        <button className="btn save" onClick={save}>Save Meal</button>
        <button className="btn ghost">Log a Portion</button>
      </div>
    </div>
  );
}
