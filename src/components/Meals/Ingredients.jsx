/**
 * Shows current ingredients + Search / New buttons.
 * Each selected ingredient can be adjusted by amount and removed.
 */
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import IngredientSearch from "./IngredientSearch";
import { listCatalogItems } from "../../services/catalogClient";
import { findBestIngredientMatch, parseIngredientList } from "../../utils/ingredientListParser";
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

function toComparableAmount(item, qty, unit) {
  if (!unit) return null;
  const gramsPerUnit = Number(item?.unit_conversions?.[unit] || 0);
  if (gramsPerUnit > 0) {
    return { value: Number(qty || 0) * gramsPerUnit, kind: "mass" };
  }
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

  const actual = toComparableAmount(item, qty, unit);
  const base = toComparableAmount(item, serving.qty, serving.unit);

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
  const units = new Set(["g", "mg", "oz", "lb"]);
  for (const unit of ["ml", "cup", "tbsp", "tsp", "piece"]) {
    if (Number(item?.unit_conversions?.[unit] || 0) > 0) {
      units.add(unit);
    }
  }
  const serving = getServingSize(item);
  if (serving?.unit) units.add(serving.unit);
  return Array.from(units);
}

export default function Ingredients({ ingredients = [], onIngredientsChange, mealDraft }) {
  const [showSearch, setShowSearch] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [pasteCatalog, setPasteCatalog] = useState([]);
  const [pasteLoading, setPasteLoading] = useState(false);
  const [pasteError, setPasteError] = useState("");
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
    if (ingredients.some((item) => item.id === ing.id)) return;
    const nextIngredient = normalizeIngredient(ing);
    pushIngredients([...ingredients, nextIngredient]);
  };

  async function analyzePaste() {
    const parsed = parseIngredientList(pasteText);
    if (!parsed.length) {
      setPasteError("Paste at least one ingredient line.");
      return;
    }
    try {
      setPasteLoading(true);
      setPasteError("");
      const catalog = pasteCatalog.length ? pasteCatalog : await listCatalogItems("ingredient");
      setPasteCatalog(catalog);
      setParsedRows(parsed.map((row) => ({
        ...row,
        matchedId: findBestIngredientMatch(row, catalog)?.id || "",
      })));
    } catch (error) {
      setPasteError(error.message || "Unable to match the ingredient list.");
    } finally {
      setPasteLoading(false);
    }
  }

  function updateParsedRow(index, changes) {
    setParsedRows((current) => current.map((row, rowIndex) => (
      rowIndex === index ? { ...row, ...changes } : row
    )));
  }

  function addParsedIngredients() {
    const selected = parsedRows.flatMap((row) => {
      const item = pasteCatalog.find((candidate) => candidate.id === row.matchedId);
      if (!item || !(Number(row.qty) > 0)) return [];
      const next = {
        ...normalizeIngredient(item),
        qty: row.qty,
        unit: row.unit,
        preparation_note: row.note || "",
      };
      return [{
        ...next,
        calories: calculateIngredientCalories(next, next.qty, next.unit),
      }];
    });
    const existingIds = new Set(ingredients.map((item) => item.id));
    pushIngredients([...ingredients, ...selected.filter((item) => !existingIds.has(item.id))]);
    setShowPaste(false);
    setPasteText("");
    setParsedRows([]);
  }

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
          <button type="button" className="btn" onClick={() => setShowSearch(true)}>Search</button>
          <button type="button" className="btn btn--ghost" onClick={() => setShowPaste((value) => !value)}>Paste List</button>
          <button
            type="button"
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

      {showPaste && (
        <div className="ing-paste">
          <label>
            <span>Paste one ingredient per line</span>
            <textarea
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              placeholder={"600g chicken breast\n300 g dry rice\n1 tbsp olive oil\n2 bell peppers"}
            />
          </label>
          <div className="ing-paste__actions">
            <button type="button" className="btn" onClick={analyzePaste} disabled={pasteLoading}>
              {pasteLoading ? "Matching…" : "Match ingredients"}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setShowPaste(false)}>Cancel</button>
          </div>
          {pasteError && <p className="ing-paste__error">{pasteError}</p>}
          {parsedRows.length > 0 && (
            <div className="ing-paste__review">
              <div className="ing-paste__review-head">
                <strong>Review matches</strong>
                <span>{parsedRows.filter((row) => row.matchedId && Number(row.qty) > 0).length} ready</span>
              </div>
              {parsedRows.map((row, index) => (
                <div className="ing-paste__row" key={row.id}>
                  <div className="ing-paste__source">{row.raw}</div>
                  <select
                    aria-label={`Catalog match for ${row.name}`}
                    value={row.matchedId}
                    onChange={(event) => updateParsedRow(index, { matchedId: event.target.value })}
                  >
                    <option value="">Choose ingredient…</option>
                    {pasteCatalog.map((item) => (
                      <option value={item.id} key={item.id}>{item.title}</option>
                    ))}
                  </select>
                  <input
                    aria-label={`Amount for ${row.name}`}
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={row.qty}
                    placeholder="Amount"
                    onChange={(event) => updateParsedRow(index, { qty: event.target.value })}
                  />
                  <select
                    aria-label={`Unit for ${row.name}`}
                    value={row.unit}
                    onChange={(event) => updateParsedRow(index, { unit: event.target.value })}
                  >
                    {["mg", "g", "oz", "lb", "ml", "cup", "tbsp", "tsp", "piece"].map((option) => (
                      <option value={option} key={option}>{option}</option>
                    ))}
                  </select>
                </div>
              ))}
              <button
                type="button"
                className="btn ing-paste__add-all"
                disabled={!parsedRows.some((row) => row.matchedId && Number(row.qty) > 0)}
                onClick={addParsedIngredients}
              >
                Add all matched ingredients
              </button>
            </div>
          )}
        </div>
      )}

      {ingredients.length > 0 && (
        <div className="ing-table-head" aria-hidden="true">
          <span>Ingredient</span>
          <span>Amount and unit</span>
          <span>Action</span>
        </div>
      )}
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
                    type="text"
                    inputMode="decimal"
                    value={ing.qty}
                    placeholder={String(ing?.unit_conversions?.serving_size?.qty || "")}
                    onChange={(e) => updateIngredient(i, {
                      qty: (e.target.value ?? "").replace(/[^0-9.]/g, ""),
                    })}
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

              <button type="button" className="ing-remove" onClick={() => removeIngredient(i)}>
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
          selectedIds={ingredients.map((ingredient) => ingredient.id)}
          mealDraft={mealDraft}
        />
      )}
    </section>
  );
}
