/**
 * Shows current ingredients + Search / New buttons.
 * Each selected ingredient can be adjusted by amount and removed.
 */
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import IngredientSearch from "./IngredientSearch";
import { listCatalogItems } from "../../services/catalogClient";
import {
  findIngredientMatches,
  normalizeIngredientName,
  parseIngredientList,
} from "../../utils/ingredientListParser";
import { saveMealDraftHandoff } from "../../utils/mealDraftHandoff";
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

const PASTE_UNITS = ["mg", "g", "oz", "lb", "ml", "cup", "tbsp", "tsp", "piece"];

export default function Ingredients({
  ingredients = [],
  onIngredientsChange,
  mealDraft,
  pasteDraft,
  onPasteDraftChange,
}) {
  const [showSearch, setShowSearch] = useState(false);
  const [showPaste, setShowPaste] = useState(Boolean(pasteDraft?.showPaste));
  const [pasteText, setPasteText] = useState(pasteDraft?.pasteText || "");
  const [parsedRows, setParsedRows] = useState(
    Array.isArray(pasteDraft?.parsedRows) ? pasteDraft.parsedRows : []
  );
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

  useEffect(() => {
    if (!pasteDraft) return;

    const created = pasteDraft.createdIngredient || null;
    const createdForRowId = pasteDraft.createdForRowId || null;
    const draftRows = Array.isArray(pasteDraft.parsedRows) ? pasteDraft.parsedRows : [];
    const createdRow = created && createdForRowId
      ? draftRows.find((row) => row.id === createdForRowId)
      : null;
    const restoredRows = createdRow
      ? draftRows.filter((row) => row.id !== createdForRowId)
      : draftRows;

    setShowPaste(Boolean(pasteDraft.showPaste));
    setPasteText(pasteDraft.pasteText || "");
    setParsedRows(restoredRows);

    if (created && createdRow) {
      const nextIngredient = ingredientFromPasteRow(created, createdRow);
      if (!ingredients.some((item) => item.id === created.id)) {
        onIngredientsChange?.([...ingredients, nextIngredient]);
      }
      setPasteCatalog((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      onPasteDraftChange?.({
        ...pasteDraft,
        parsedRows: restoredRows,
        createdIngredient: null,
        createdForRowId: null,
      });
    }
  }, [ingredients, onIngredientsChange, onPasteDraftChange, pasteDraft]);

  useEffect(() => {
    if (!pasteDraft || !Array.isArray(pasteDraft.parsedRows) || !pasteDraft.parsedRows.length) return undefined;

    let active = true;
    async function restorePasteCatalog() {
      try {
        const catalog = await listCatalogItems("ingredient");
        if (!active) return;
        const created = pasteDraft.createdIngredient;
        setPasteCatalog(
          created
            ? [created, ...catalog.filter((item) => item.id !== created.id)]
            : catalog
        );
      } catch (error) {
        if (active) {
          setPasteError(error.message || "Unable to reload ingredient matches.");
        }
      }
    }

    void restorePasteCatalog();
    return () => {
      active = false;
    };
  }, [pasteDraft]);

  function savePasteDraft(overrides = {}) {
    onPasteDraftChange?.({ showPaste, pasteText, parsedRows, ...overrides });
  }

  function closePaste() {
    setShowPaste(false);
    setPasteError("");
    onPasteDraftChange?.(null);
  }

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
      const nextRows = parsed.map((row) => {
        const candidates = findIngredientMatches(row, catalog);
        const exact = candidates.find((candidate) => (
          normalizeIngredientName(candidate.title || candidate.name) === row.normalizedName
        ));
        return {
          ...row,
          matchedId: exact?.id || "",
          candidateIds: candidates.map((candidate) => candidate.id),
        };
      });
      setParsedRows(nextRows);
      savePasteDraft({ showPaste: true, parsedRows: nextRows });
    } catch (error) {
      setPasteError(error.message || "Unable to match the ingredient list.");
    } finally {
      setPasteLoading(false);
    }
  }

  function updateParsedRow(index, changes) {
    setParsedRows((current) => {
      const next = current.map((row, rowIndex) => (
        rowIndex === index ? { ...row, ...changes } : row
      ));
      savePasteDraft({ showPaste: true, parsedRows: next });
      return next;
    });
  }

  function addMissingIngredient(row) {
    const handoff = {
      ingredientName: row.name,
      mealDraft: {
        ...mealDraft,
        ingredientPasteDraft: { showPaste: true, pasteText, parsedRows },
      },
      returnPasteRowId: row.id,
      returnTo: location.pathname,
    };
    saveMealDraftHandoff(handoff);
    navigate("/ingredients/new", {
      state: handoff,
    });
  }

  function ingredientFromPasteRow(item, row) {
    const next = {
      ...normalizeIngredient(item),
      qty: row.qty,
      unit: row.unit,
      preparation_note: row.note || "",
    };
    return {
      ...next,
      calories: calculateIngredientCalories(next, next.qty, next.unit),
    };
  }

  function addMatchedIngredient(index, itemId) {
    const row = parsedRows[index];
    const item = pasteCatalog.find((candidate) => candidate.id === itemId);
    if (!row || !item) return;
    if (!(Number(row.qty) > 0)) {
      setPasteError(`Add an amount for ${row.name} before selecting its match.`);
      return;
    }

    const nextIngredient = ingredientFromPasteRow(item, row);
    const nextRows = parsedRows.filter((_, rowIndex) => rowIndex !== index);
    if (!ingredients.some((ingredient) => ingredient.id === item.id)) {
      pushIngredients([...ingredients, nextIngredient]);
    }
    setParsedRows(nextRows);
    savePasteDraft({ showPaste: true, parsedRows: nextRows });
    setPasteError("");
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
    onPasteDraftChange?.(null);
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
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              const next = !showPaste;
              setShowPaste(next);
              savePasteDraft({ showPaste: next });
            }}
          >
            Paste List
          </button>
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
            <small>Use: ingredient name, amount and measurement</small>
            <textarea
              value={pasteText}
              onChange={(event) => {
                setPasteText(event.target.value);
                savePasteDraft({ showPaste: true, pasteText: event.target.value });
              }}
              placeholder={"Chicken breast, 600 g\nDry rice, 300 g\nOlive oil, 1 tbsp\nBell pepper, 2 pieces"}
            />
          </label>
          <div className="ing-paste__actions">
            <button type="button" className="btn" onClick={analyzePaste} disabled={pasteLoading}>
              {pasteLoading ? "Matching…" : "Match ingredients"}
            </button>
            <button type="button" className="btn btn--ghost" onClick={closePaste}>Cancel</button>
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
                  <div className="ing-paste__row-head">
                    <div><strong>{row.name}</strong><span>{row.raw}</span></div>
                    <span className={row.matchedId ? "is-ready" : "needs-match"}>
                      {row.matchedId ? "Ready" : "Needs a match"}
                    </span>
                  </div>
                  <div className="ing-paste__matches">
                    <span className="ing-paste__field-label">Ingredient match</span>
                    <div className="ing-paste__suggestions">
                      {(row.candidateIds || []).map((id) => {
                        const item = pasteCatalog.find((candidate) => candidate.id === id);
                        if (!item) return null;
                        return (
                          <button
                            type="button"
                            key={id}
                            className={row.matchedId === id ? "is-selected" : ""}
                            onClick={() => addMatchedIngredient(index, id)}
                          >
                            {item.title}
                          </button>
                        );
                      })}
                      <button type="button" className="ing-paste__new" onClick={() => addMissingIngredient(row)}>
                        + Add “{row.name}” as new
                      </button>
                    </div>
                  </div>
                  <label className="ing-paste__amount">
                    <span className="ing-paste__field-label">Amount used</span>
                    <div>
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
                        {PASTE_UNITS.map((option) => (
                          <option value={option} key={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  </label>
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
