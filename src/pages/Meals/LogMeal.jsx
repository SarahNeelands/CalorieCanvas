import React, { useEffect, useState } from "react";
import NavBar from "../../components/NavBar";
import { useLocation, useNavigate } from "react-router-dom";
import MealDetails from "../../components/Meals/MealDetails";
import Ingredients from "../../components/Meals/Ingredients";
import MealSummary from "../../components/Meals/MealSummary";
import { createCatalogItem, updateCatalogItem } from "../../services/catalogClient";
import "./LogMeal.css";

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

function calculateIngredientMacro(item, qty, unit, key) {
  const macros = item?.unit_conversions?.macros;
  const ratio = calculateRatio(item, qty, unit);

  if (macros && typeof macros[key] === "number") {
    return macros[key] * ratio;
  }

  if (unit === "g" && key === "calories") {
    return (Number(item?.kcal_per_100g) || 0) * ((Number(qty) || 0) / 100);
  }

  if (unit === "g" && key === "protein") {
    return (Number(item?.protein_g_per_100g) || 0) * ((Number(qty) || 0) / 100);
  }

  if (unit === "g" && key === "carbs") {
    return (Number(item?.carbs_g_per_100g) || 0) * ((Number(qty) || 0) / 100);
  }

  if (unit === "g" && key === "fat") {
    return (Number(item?.fat_g_per_100g) || 0) * ((Number(qty) || 0) / 100);
  }

  return 0;
}

function calculateIngredientMicro(item, qty, unit, key) {
  const micros = item?.unit_conversions?.micros;
  const ratio = calculateRatio(item, qty, unit);

  if (micros && typeof micros[key]?.value === "number") {
    return micros[key].value * ratio;
  }

  return 0;
}

function estimateIngredientWeightGrams(item, qty, unit) {
  const numericQty = Number(qty || 0);
  if (!(numericQty > 0)) return 0;

  const normalizedUnit = String(unit || "").trim().toLowerCase();
  if (MASS_UNIT_TO_GRAMS[normalizedUnit]) {
    return numericQty * MASS_UNIT_TO_GRAMS[normalizedUnit];
  }

  if (VOLUME_UNIT_TO_ML[normalizedUnit]) {
    return numericQty * VOLUME_UNIT_TO_ML[normalizedUnit];
  }

  const serving = getServingSize(item);
  if (!serving?.qty || !serving?.unit) {
    return 0;
  }

  const actual = toComparableAmount(numericQty, normalizedUnit);
  const base = toComparableAmount(serving.qty, serving.unit);
  if (actual && base && actual.kind === base.kind && base.value > 0) {
    const servingWeight = estimateIngredientWeightGrams(item, serving.qty, serving.unit);
    if (servingWeight > 0) {
      return (actual.value / base.value) * servingWeight;
    }
  }

  return 0;
}

function estimateRecipeWeightGrams(ingredients) {
  return ingredients.reduce(
    (sum, ingredient) => sum + estimateIngredientWeightGrams(ingredient, ingredient.qty, ingredient.unit),
    0
  );
}

/**
 * LogMeal layout:
 * Left side: two equal halves that shrink when space is limited (no internal scroll)
 * Right side: summary (sticky on desktop)
 */
export default function LogMeal({ user }) {
  const avatar = user?.avatar ?? "/cc/avatar.png";
  const location = useLocation();
  const navigate = useNavigate();

  const [ingredients, setIngredients] = useState([]);
  const [mealName, setMealName] = useState("");
  const [timestamp, setTimestamp] = useState("");
  const [totalWeight, setTotalWeight] = useState("");
  const [servingCount, setServingCount] = useState("");
  const [savingMeal, setSavingMeal] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [editingMealId, setEditingMealId] = useState(null);

  useEffect(() => {
    if (!location.state?.resetIngredients) return;

    setIngredients([]);
    setMealName("");
    setTimestamp("");
    setTotalWeight("");
    setServingCount("");
    setEditingMealId(null);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    const draft = location.state?.mealDraft;
    if (!draft) return;

    setIngredients(Array.isArray(draft.ingredients) ? draft.ingredients : []);
    setMealName(draft.mealName || "");
    setTimestamp(draft.timestamp || "");
    setTotalWeight(
      draft.totalWeight === undefined || draft.totalWeight === null
        ? ""
        : String(draft.totalWeight)
    );
    setServingCount(
      draft.servingCount === undefined || draft.servingCount === null
        ? ""
        : String(draft.servingCount)
    );
    setEditingMealId(draft.editingMealId || null);

    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    const editMeal = location.state?.editMeal;
    if (!editMeal) return;

    const storedConversions = editMeal.unit_conversions || {};
    const savedIngredients = Array.isArray(editMeal.unit_conversions?.ingredients)
      ? editMeal.unit_conversions.ingredients.map((ingredient) => ({
          ...ingredient,
          name: ingredient.name || ingredient.title || "",
          title: ingredient.title || ingredient.name || "",
          qty: ingredient.qty === undefined || ingredient.qty === null ? "" : String(ingredient.qty),
          unit: ingredient.unit || ingredient.unit_conversions?.serving_size?.unit || "g",
          calories: Number(ingredient.calories || 0),
        }))
      : [];
    const restoredWeight = storedConversions.servings_count ? "" : (storedConversions.total_weight_g ?? "");
    const restoredServingCount =
      storedConversions.servings_count ??
      (
        Number(storedConversions.total_weight_g) > 0 &&
        Number(storedConversions.quantity) > 0
          ? Number(storedConversions.total_weight_g) / Number(storedConversions.quantity)
          : ""
      );

    setIngredients(savedIngredients);
    setMealName(editMeal.title || "");
    setTimestamp(editMeal.created_at ? editMeal.created_at.slice(0, 16) : "");
    setTotalWeight(restoredWeight === "" ? "" : String(restoredWeight));
    setServingCount(restoredServingCount === "" ? "" : String(restoredServingCount));
    setEditingMealId(editMeal.id || null);

    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  const mealDraft = {
    ingredients,
    mealName,
    timestamp,
    totalWeight,
    servingCount,
    editingMealId,
  };

  const inferredTotalWeight = estimateRecipeWeightGrams(ingredients);
  const effectiveTotalWeight = Number(totalWeight || 0) > 0 ? Number(totalWeight) : inferredTotalWeight;

  async function saveMeal({ openLogAfterSave = false } = {}) {
    setSavingMeal(true);
    setSaveError(null);

    try {
      if (!mealName.trim()) {
        throw new Error("Enter a meal name before saving.");
      }

      if (!ingredients.length) {
        throw new Error("Add at least one ingredient before saving.");
      }

      const enteredTotalWeight = Number(totalWeight || 0);
      const enteredServingCount = Number(servingCount || 0);
      if (enteredTotalWeight > 0 && enteredServingCount > 0) {
        throw new Error("Enter either total weight or servings, not both.");
      }
      if (!(enteredTotalWeight > 0) && !(enteredServingCount > 0)) {
        throw new Error("Enter total weight or servings before saving.");
      }

      const numericTotalWeight = enteredTotalWeight > 0 ? enteredTotalWeight : estimateRecipeWeightGrams(ingredients);
      if (!(numericTotalWeight > 0)) {
        throw new Error("Unable to derive total weight from the ingredients. Enter a total weight instead.");
      }

      const numericServingCount = enteredServingCount > 0 ? enteredServingCount : null;

      const totals = ingredients.reduce(
        (acc, ingredient) => {
          acc.calories += calculateIngredientMacro(ingredient, ingredient.qty, ingredient.unit, "calories");
          acc.protein += calculateIngredientMacro(ingredient, ingredient.qty, ingredient.unit, "protein");
          acc.carbs += calculateIngredientMacro(ingredient, ingredient.qty, ingredient.unit, "carbs");
          acc.fat += calculateIngredientMacro(ingredient, ingredient.qty, ingredient.unit, "fat");
          acc.fiber += calculateIngredientMacro(ingredient, ingredient.qty, ingredient.unit, "fiber");
          acc.sugar += calculateIngredientMacro(ingredient, ingredient.qty, ingredient.unit, "sugar");
          acc.cholesterol += calculateIngredientMacro(ingredient, ingredient.qty, ingredient.unit, "cholesterol");
          acc.sodium += calculateIngredientMicro(ingredient, ingredient.qty, ingredient.unit, "sodium");
          acc.potassium += calculateIngredientMicro(ingredient, ingredient.qty, ingredient.unit, "potassium");
          acc.calcium += calculateIngredientMicro(ingredient, ingredient.qty, ingredient.unit, "calcium");
          acc.iron += calculateIngredientMicro(ingredient, ingredient.qty, ingredient.unit, "iron");
          acc.vitaminA += calculateIngredientMicro(ingredient, ingredient.qty, ingredient.unit, "vitaminA");
          acc.vitaminC += calculateIngredientMicro(ingredient, ingredient.qty, ingredient.unit, "vitaminC");
          return acc;
        },
        {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          sugar: 0,
          cholesterol: 0,
          sodium: 0,
          potassium: 0,
          calcium: 0,
          iron: 0,
          vitaminA: 0,
          vitaminC: 0,
        }
      );

      const scale = 100 / numericTotalWeight;
      const gramsPerServing = numericServingCount ? numericTotalWeight / numericServingCount : null;
      const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

      const payload = {
        title: mealName.trim(),
        item_type: "meal",
        created_at: timestamp ? new Date(timestamp).toISOString() : undefined,
        kcal_per_100g: round2(totals.calories * scale),
        protein_g_per_100g: round2(totals.protein * scale),
        carbs_g_per_100g: round2(totals.carbs * scale),
        fat_g_per_100g: round2(totals.fat * scale),
        unit_conversions: {
          quantity: gramsPerServing ? round2(gramsPerServing) : null,
          quantity_label: gramsPerServing ? "serving" : null,
          macros_per_100g: {
            fiber: round2(totals.fiber * scale),
            sugar: round2(totals.sugar * scale),
            cholesterol: round2(totals.cholesterol * scale),
          },
          micros_per_100g: {
            sodium: round2(totals.sodium * scale),
            potassium: round2(totals.potassium * scale),
            calcium: round2(totals.calcium * scale),
            iron: round2(totals.iron * scale),
            vitaminA: round2(totals.vitaminA * scale),
            vitaminC: round2(totals.vitaminC * scale),
          },
          serving_size: {
            qty: gramsPerServing ? round2(gramsPerServing) : numericTotalWeight,
            unit: gramsPerServing ? "serving" : "g",
          },
          total_weight_g: numericTotalWeight,
          servings_count: numericServingCount ? round2(numericServingCount) : null,
          ingredients: ingredients.map((ingredient) => ({
            ...ingredient,
            name: ingredient.name || ingredient.title,
            title: ingredient.title || ingredient.name,
            qty: ingredient.qty || "",
            unit: ingredient.unit || "g",
            calories: Number(ingredient.calories || 0),
          })),
        },
      };

      const savedItem = editingMealId
        ? await updateCatalogItem(editingMealId, payload)
        : await createCatalogItem(payload);

      navigate("/meals", {
        replace: true,
        state: openLogAfterSave
          ? {
              openLogMeal: true,
              selectedLogItem: savedItem,
            }
          : {},
      });
    } catch (error) {
      setSaveError(error);
    } finally {
      setSavingMeal(false);
    }
  }

  async function handleSaveMeal() {
    await saveMeal();
  }

  async function handleLogPortion() {
    await saveMeal({ openLogAfterSave: true });
  }

  return (
    <div className="logmeal-page">
      <NavBar profileImageSrc={avatar} />

      <main className="logmeal-wrap">
        <div className="logmeal-grid">
          {/* LEFT COLUMN */}
          <section className="left-col">
            {/* Top half */}
            <div className="card card--details">
              <MealDetails
                mealName={mealName}
              timestamp={timestamp}
              totalWeight={totalWeight}
              servingCount={servingCount}
              onMealNameChange={setMealName}
              onTimestampChange={setTimestamp}
              onTotalWeightChange={(value) => {
                setTotalWeight(value);
                if (value !== "") {
                  setServingCount("");
                }
              }}
              onServingCountChange={(value) => {
                setServingCount(value);
                if (value !== "") {
                  setTotalWeight("");
                }
              }}
            />
            </div>

            {/* Bottom half */}
            <div className="card card--ingredients">
              <Ingredients
                ingredients={ingredients}
                onIngredientsChange={setIngredients}
                mealDraft={mealDraft}
              />
            </div>
          </section>

          {/* RIGHT COLUMN */}
          <aside className="card card--summary" style={{ minWidth: 0 }}>
            <MealSummary
              ingredients={ingredients}
              totalWeight={effectiveTotalWeight}
              servingCount={Number(servingCount || 0)}
              saving={savingMeal}
              error={saveError}
              onSave={handleSaveMeal}
              onLogPortion={handleLogPortion}
              isEditing={Boolean(editingMealId)}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
