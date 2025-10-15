/** NewIngredientPage.jsx
 * Simple form to create a new ingredient in the catalog (stub for DB).
 */


import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
// import { createIngredient } from "../utils/db";

export default function NewIngredientPage() {
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!name || !calories) return;
    // await createIngredient({ name, calories: Number(calories), ...moreFields });
    navigate(-1); // go back to the log page
  };

  return (
    <main className="page form-page">
      <h2>New Ingredient</h2>
      <label>Name<input value={name} onChange={(e)=>setName(e.target.value)} /></label>
      <label>Calories (per serving / 100g)
        <input type="number" value={calories} onChange={(e)=>setCalories(e.target.value)} />
      </label>
      <div className="row gap-8">
        <button onClick={handleCreate}>Save</button>
        <button className="secondary" onClick={()=>navigate(-1)}>Cancel</button>
      </div>
    </main>
  );
}
