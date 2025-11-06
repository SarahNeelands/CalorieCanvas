/**
 * Shows current ingredients + Search / New buttons.
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import IngredientSearch from "./IngredientSearch";
import "./Ingredients.css";

export default function Ingredients({ onIngredientsChange }) {
  const [ingredients, setIngredients] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const navigate = useNavigate();

  const handleAdd = (ing) => {
    const updated = [...ingredients, ing];
    setIngredients(updated);
    onIngredientsChange?.(updated);
    setShowSearch(false);
  };

  return (
    <section className="ing-root">
      <header className="ing-head row-between">
        <h3>Add to Meal</h3>
        <div className="ing-actions">
          <button className="btn" onClick={() => setShowSearch(true)}>Search</button>
          <button className="btn btn--ghost" onClick={() => navigate("/ingredients/new")}>
            New Ingredient
          </button>
        </div>
      </header>

      <ul className="ing-list">
        {ingredients.map((ing, i) => (
          <li key={`${ing.id ?? ing.name}-${i}`} className="ing-item">
            <div className="ing-name">{ing.name}</div>
            <div className="ing-meta">{Math.round(ing.calories)} kcal</div>
          </li>
        ))}
        {ingredients.length === 0 && (
          <li className="ing-empty">No ingredients yet — add some above.</li>
        )}
      </ul>

      {showSearch && (
        <IngredientSearch onSelect={handleAdd} onClose={() => setShowSearch(false)} />
      )}
    </section>
  );
}
