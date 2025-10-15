/**
 * SnackDetails.jsx
 * Page to create a new snack in the catalog (name + either kcal/100g or kcal/unit).
 * Hook this to your DB and then redirect back to MealsPage.
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function SnackDetails() {
  const [name, setName] = useState("");
  const [mode, setMode] = useState("per100g"); // 'per100g' | 'perUnit'
  const [kcal, setKcal] = useState("");
  const navigate = useNavigate();

  const save = async () => {
    if (!name || !kcal) return alert("Fill all fields.");
    // TODO: persist to DB
    navigate("/meals");
  };

  return (
    <main className="page form-page">
      <h2>New Snack</h2>

      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <div className="row gap-12">
        <label className="row gap-6">
          <input
            type="radio"
            checked={mode === "per100g"}
            onChange={() => setMode("per100g")}
          />
          kcal / 100g
        </label>
        <label className="row gap-6">
          <input
            type="radio"
            checked={mode === "perUnit"}
            onChange={() => setMode("perUnit")}
          />
          kcal / unit
        </label>
      </div>

      <label>
        {mode === "per100g" ? "Calories per 100g" : "Calories per unit"}
        <input type="number" value={kcal} onChange={(e) => setKcal(e.target.value)} />
      </label>

      <div className="row gap-8">
        <button className="secondary" onClick={() => navigate(-1)}>Cancel</button>
        <button onClick={save}>Save</button>
      </div>
    </main>
  );
}
