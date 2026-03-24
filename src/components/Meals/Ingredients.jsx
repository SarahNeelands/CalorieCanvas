/**
 * Shows current ingredients + Search / New buttons.
 * Each selected ingredient can be adjusted by amount and removed.
 */
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import IngredientSearch from "./IngredientSearch";
import "./Ingredients.css";

const MASS_UNIT_TO_GRAMS = {
  mg: 0.001,
  g: 1,
  oz: 28.3495,
  lb: 453.592,
};

const VOLUME_UNIT_TO_ML = {
  ml: 1,
  tsp: 4.92892,
  tbsp: 14.7868,
  cup: 236.588,
};

function toComparableAmount(qty, unit) {
  if (!unit) return null;
  if (MASS_UNIT_TO_GRAMS[unit]) {
    return { value: Number(qty || 0) * MASS_UNIT_TO_GRAMS[unit], kind: "mass" };
  }
  if (VOLUME_UNIT_TO_ML[unit]) {
    return { value: Number(qty || 0) * VOLUME_UNIT_TO_ML[unit], kind: "volume" };
  }
  if (unit === "piece") {
    return { value: Number(qty || 0), kind: "count" };
  }
  return null;
}

function getServingSize(item) {
  return item?.unit_conversions?.serving_size || null;
}

function getDefaultUsage(item) {
  const serving = getServingSize(item);

  if (serving?.unit) {
    return {
      qty: "",
      unit: serving.unit,
    };
  }

  return { qty: "", unit: "g" };
}

function calculateRatio(item, qty, unit) {
  const serving = getServingSize(item);
  if (!serving?.qty || !serving?.unit) {
    if (unit === "g") return (Number(qty) || 0) / 100;
    return 0;
  }

  const actual = toComparableAmount(qty, unit);
  const base = toComparableAmount(serving.qty, serving.unit);

  if (actual && base && actual.kind === base.kind && base.value > 0) {
    return actual.value / base.value;
  }

  if (unit === serving.unit && Number(serving.qty) > 0) {
    return (Number(qty) || 0) / Number(serving.qty);
  }

  return 0;
}

function calculateIngredientCalories(item, qty, unit) {
  const macros = item?.unit_conversions?.macros;
  const ratio = calculateRatio(item, qty, unit);

  if (macros && typeof macros.calories === "number") {
    return macros.calories * ratio;
  }

  if (unit === "g") {
    return (Number(item?.kcal_per_100g) || 0) * ((Number(qty) || 0) / 100);
  }

  return 0;
}

function normalizeIngredient(item) {
  const usage = getDefaultUsage(item);

  return {
    ...item,
    name: item.name || item.title,
    qty: usage.qty,
    unit: usage.unit,
    calories: 0,
  };
}

function availableUnits(item) {
  const units = new Set(["g", "mg", "oz", "lb", "ml", "cup", "tbsp", "tsp", "piece"]);
  const serving = getServingSize(item);
  if (serving?.unit) units.add(serving.unit);
  return Array.from(units);
}

export default function Ingredients({ ingredients = [], onIngredientsChange, mealDraft }) {
  const [showSearch, setShowSearch] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  function pushIngredients(nextIngredients) {
    onIngredientsChange?.(nextIngredients);
  }

  useEffect(() => {
    if (!Array.isArray(ingredients)) {
      onIngredientsChange?.([]);
    }
  }, [ingredients, onIngredientsChange]);

  const handleAdd = (ing) => {
    const nextIngredient = normalizeIngredient(ing);
    pushIngredients([...ingredients, nextIngredient]);
    setShowSearch(false);
  };

  function updateIngredient(index, changes) {
    const updated = ingredients.map((ingredient, i) => {
      if (i !== index) return ingredient;

      const next = { ...ingredient, ...changes };
      return {
        ...next,
        calories: calculateIngredientCalories(next, next.qty, next.unit),
      };
    });

    pushIngredients(updated);
  }

  function removeIngredient(index) {
    pushIngredients(ingredients.filter((_, i) => i !== index));
  }

  return (
    <section className="ing-root">
      <header className="ing-head row-between">
        <h3>Add to Meal</h3>
        <div className="ing-actions">
          <button className="btn" onClick={() => setShowSearch(true)}>Search</button>
          <button
            className="btn btn--ghost"
            onClick={() => navigate("/ingredients/new", {
              state: {
                mealDraft,
                returnTo: location.pathname,
              },
            })}
          >
            New Ingredient
          </button>
        </div>
      </header>

      <ul className="ing-list">
        {ingredients.map((ing, i) => (
          <li key={`${ing.id ?? ing.name}-${i}`} className="ing-item">
            <div className="ing-main">
              <div className="ing-name">{ing.name}</div>
              <div className="ing-meta">{Math.round(ing.calories)} kcal</div>
              <div className="ing-serving">
                Nutrition saved for {ing?.unit_conversions?.serving_size?.qty || 0} {ing?.unit_conversions?.serving_size?.unit || "g"}
              </div>
            </div>

            <div className="ing-controls">
              <label className="ing-amount">
                <span>Amount used</span>
                <div className="ing-amount-row">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ing.qty}
                    placeholder={String(ing?.unit_conversions?.serving_size?.qty || "")}
                    onChange={(e) => updateIngredient(i, { qty: e.target.value })}
                  />
                  <select
                    value={ing.unit}
                    onChange={(e) => updateIngredient(i, { unit: e.target.value })}
                  >
                    {availableUnits(ing).map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
              </label>

              <button className="ing-remove" onClick={() => removeIngredient(i)}>
                Remove
              </button>
            </div>
          </li>
        ))}
        {ingredients.length === 0 && (
          <li className="ing-empty">No ingredients yet. Add some above.</li>
        )}
      </ul>

      {showSearch && (
        <IngredientSearch
          onSelect={handleAdd}
          onClose={() => setShowSearch(false)}
          mealDraft={mealDraft}
        />
      )}
    </section>
  );
}
