/** Ingredients.jsx
 * Displays current ingredients; provides "Search Ingredient" (with + to add)
 * and "New Ingredient" navigation to create a catalog item.
 */


import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import IngredientSearch from "./IngredientSearch";

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
    <section className="ingredients">
      <div className="row-between">
        <h3>Ingredients</h3>
        <div className="actions gap-8">
          <button type="button" onClick={() => setShowSearch(true)}>
            Search Ingredient
          </button>
          <button
            type="button"
            onClick={() => navigate("/ingredients/new")}
            aria-label="Create a new ingredient"
          >
            New Ingredient
          </button>
        </div>
      </div>

      <ul className="ingredient-list">
        {ingredients.map((ing, i) => (
          <li key={`${ing.id ?? ing.name}-${i}`} className="ingredient-item">
            <span className="name">{ing.name}</span>
            <span className="meta">{Math.round(ing.calories)} kcal</span>
          </li>
        ))}
      </ul>

      {showSearch && (
        <IngredientSearch
          onSelect={handleAdd}
          onClose={() => setShowSearch(false)}
        />
      )}
    </section>
  );
}
