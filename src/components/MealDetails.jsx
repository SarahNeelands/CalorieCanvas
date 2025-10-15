/** MealDetails.jsx
 * Collects meal name, timestamp (auto-filled, editable), and total meal weight.
 * On create, emits a new meal record (hook to DB via createMeal()).
 */


import React, { useState, useEffect } from "react";
import { createMeal } from "../utils/db";

export default function MealDetails({ onMealCreate }) {
  const [mealName, setMealName] = useState("");
  const [timestamp, setTimestamp] = useState("");
  const [totalWeight, setTotalWeight] = useState("");

  useEffect(() => {
    const now = new Date();
    setTimestamp(now.toISOString().slice(0, 16)); // "YYYY-MM-DDTHH:mm"
  }, []);

  const handleSubmit = async () => {
    if (!mealName || !totalWeight) return alert("Please fill all fields.");

    const mealData = { mealName, timestamp, totalWeight };
    const mealId = await createMeal(mealData);
    onMealCreate(mealId);
  };

  return (
    <div className="meal-details">
      <h2>Meal Details</h2>
      <input
        type="text"
        placeholder="Meal Name"
        value={mealName}
        onChange={(e) => setMealName(e.target.value)}
      />
      <input
        type="datetime-local"
        value={timestamp}
        onChange={(e) => setTimestamp(e.target.value)}
      />
      <input
        type="number"
        placeholder="Total Weight (g)"
        value={totalWeight}
        onChange={(e) => setTotalWeight(e.target.value)}
      />
      <button onClick={handleSubmit}>Create Meal</button>
    </div>
  );
}
