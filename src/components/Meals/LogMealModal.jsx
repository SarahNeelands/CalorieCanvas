import React from "react";
import { useNavigate } from "react-router-dom";
import Modal from '../ui/Modal.jsx';
import { resolveToGrams, unitOptionsForFood } from "../../utils/units";
import { createMealLog } from "../../services/mealLogClient";
import { toMassValue } from "../../utils/nutrients";
import "./LogMealModal.css";

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function scalePer100gValue(value, grams) {
  return round2((Number(value || 0) * Number(grams || 0)) / 100);
}

function scaleNutrients(grams, per100g = {}) {
  return {
    calories: scalePer100gValue(per100g.calories, grams),
    protein: scalePer100gValue(per100g.protein, grams),
    carbs: scalePer100gValue(per100g.carbs, grams),
    fat: scalePer100gValue(per100g.fat, grams),
    fiber: scalePer100gValue(per100g.fiber, grams),
    sugar: scalePer100gValue(per100g.sugar, grams),
    cholesterol: scalePer100gValue(per100g.cholesterol, grams),
  };
}

function scaleMicros(grams, per100g = {}) {
  return Object.fromEntries(
    Object.entries(per100g).map(([key, value]) => [key, scalePer100gValue(value, grams)])
  );
}

function servingUnitToGrams(qty, unit) {
  const numericQty = Number(qty || 0);
  if (!(numericQty > 0)) return null;

  const normalizedUnit = String(unit || "g").trim().toLowerCase();
  const gramsByUnit = {
    mg: 0.001,
    g: 1,
    oz: 28.3495,
    lb: 453.592,
    ml: 1,
    cup: 236.588,
    tbsp: 14.7868,
    tsp: 4.92892,
  };

  if (!gramsByUnit[normalizedUnit]) return null;
  return numericQty * gramsByUnit[normalizedUnit];
}

function derivePer100gFromServing(value, item, isMicro = false) {
  const serving = item?.unit_conversions?.serving_size;
  const gramsPerServing = servingUnitToGrams(serving?.qty, serving?.unit);
  const numericValue = Number(value || 0);

  if (!(gramsPerServing > 0)) return 0;

  if (isMicro) {
    return numericValue * (100 / gramsPerServing);
  }

  return numericValue * (100 / gramsPerServing);
}

function getMacroPer100g(item, key) {
  const per100g = item?.unit_conversions?.macros_per_100g;
  if (typeof per100g?.[key] === "number") {
    return Number(per100g[key] || 0);
  }

  const servingMacros = item?.unit_conversions?.macros;
  if (typeof servingMacros?.[key] === "number") {
    return derivePer100gFromServing(servingMacros[key], item);
  }

  return 0;
}

function getMicroPer100g(item, key) {
  const per100g = item?.unit_conversions?.micros_per_100g;
  if (typeof per100g?.[key] === "number") {
    return Number(per100g[key] || 0);
  }

  const servingMicros = item?.unit_conversions?.micros;
  if (servingMicros?.[key]?.value !== undefined && servingMicros?.[key]?.value !== null) {
    return derivePer100gFromServing(
      toMassValue(servingMicros[key].value, servingMicros[key].unit, key),
      item,
      true
    );
  }

  return 0;
}

function getMealPer100g(item) {
  return {
    calories: Number(item.kcal_per_100g || 0),
    protein: Number(item.protein_g_per_100g || 0),
    carbs: Number(item.carbs_g_per_100g || 0),
    fat: Number(item.fat_g_per_100g || 0),
    fiber: getMacroPer100g(item, "fiber"),
    sugar: getMacroPer100g(item, "sugar"),
    cholesterol: getMacroPer100g(item, "cholesterol"),
  };
}

function getMicrosPer100g(item) {
  return {
    sodium: getMicroPer100g(item, "sodium"),
    potassium: getMicroPer100g(item, "potassium"),
    calcium: getMicroPer100g(item, "calcium"),
    iron: getMicroPer100g(item, "iron"),
    vitaminA: getMicroPer100g(item, "vitaminA"),
    vitaminC: getMicroPer100g(item, "vitaminC"),
  };
}

function getUnitLabel(item, unit) {
  if (unit !== "quantity") return unit;
  return item?.unit_conversions?.quantity_label || "snack";
}

function getDefaultUnit(item, availableUnits) {
  if (availableUnits.includes("quantity")) {
    return "quantity";
  }
  return availableUnits[0] || "g";
}

export default function LogMealModal({ open, onClose, userId, item }) {
  const navigate = useNavigate();
  const [whenAt, setWhenAt] = React.useState(new Date().toISOString());
  const [qty, setQty] = React.useState("");
  const [unit, setUnit] = React.useState("g");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);
  const availableUnits = unitOptionsForFood(item);

  React.useEffect(() => {
    if (open) {
      setWhenAt(new Date().toISOString());
      setUnit(getDefaultUnit(item, availableUnits));
      setQty("");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !item) return null;

  async function handleSave(e) {
    e?.preventDefault?.();
    try {
      setSaving(true);
      setError(null);
      if (!userId) throw new Error("Missing user");
      if (qty === "" || Number(qty) <= 0) throw new Error("Enter an amount.");

      const grams = resolveToGrams({ unit, qty, item });
      const macros = scaleNutrients(grams, getMealPer100g(item));
      const micros = scaleMicros(grams, getMicrosPer100g(item));

      const payload = {
        user_id: userId,
        meal_id: item.id,
        food_id: item.food_id ?? null,
        qty,
        unit_code: unit,
        grams_resolved: grams,
        logged_at: whenAt,
        kcal: macros.calories,
        protein_g: macros.protein,
        carbs_g: macros.carbs,
        fat_g: macros.fat,
        fiber_g: macros.fiber,
        sugar_g: macros.sugar,
        cholesterol_mg: macros.cholesterol,
        micros,
      };

      await createMealLog(payload);
      window.dispatchEvent(new CustomEvent("meal-logged", { detail: { payload } }));
      onClose?.();
      navigate("/", { replace: false });
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Log "${item.title}"`} onClose={onClose}>
      <form onSubmit={handleSave} className="meal-log-modal">
        <label className="meal-log-modal__field">
          <div className="meal-log-modal__label">Date & Time</div>
          <input
            className="meal-log-modal__input"
            type="datetime-local"
            value={new Date(whenAt).toISOString().slice(0,16)}
            onChange={(e) => {
              const local = e.target.value;
              const iso = new Date(local).toISOString();
              setWhenAt(iso);
            }}
          />
        </label>
        <div className="meal-log-modal__row">
          <label className="meal-log-modal__field meal-log-modal__field--grow">
            <div className="meal-log-modal__label">Amount</div>
            <input
              className="meal-log-modal__input"
              type="number"
              min={0}
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </label>
          <label className="meal-log-modal__field meal-log-modal__field--unit">
            <div className="meal-log-modal__label">Unit</div>
            <select className="meal-log-modal__select" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {availableUnits.map((u) => (
                <option key={u} value={u}>{getUnitLabel(item, u)}</option>
              ))}
            </select>
          </label>
        </div>
        {error && <div className="meal-log-modal__error">{String(error.message || error)}</div>}
        <div className="meal-log-modal__actions">
          <button type="button" className="meal-log-modal__secondary-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="meal-log-modal__primary-btn" disabled={saving}>{saving ? "Saving…" : "Log Meal Item"}</button>
        </div>
      </form>
    </Modal>
  );
}
