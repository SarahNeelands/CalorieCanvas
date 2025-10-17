/** MealSummary.jsx
 * Summarizes count of ingredients, total kcal, and kcal per 100g; Save & redirect.
 */


import React from "react";
import { saveMeal } from "../utils/db";
import { useNavigate } from "react-router-dom";

export default function MealSummary({ ingredients, totalWeight }) {
  const navigate = useNavigate();

  const totalCalories = ingredients.reduce((sum, ing) => sum + ing.calories, 0);
  const per100g = totalWeight ? (totalCalories / totalWeight) * 100 : 0;

  const handleSave = async () => {
    await saveMeal({ ingredients, totalCalories, per100g });
    navigate("/"); // redirect to MainPage
  };

  return (
    <div className="meal-summary">
      <h3>Meal Summary</h3>
      <p>Total Ingredients: {ingredients.length}</p>
      <p>Total Calories: {totalCalories.toFixed(0)} kcal</p>
      <p>Calories per 100g: {per100g.toFixed(1)} kcal</p>
      <button onClick={handleSave}>Save Meal</button>
    </div>
  );
}
