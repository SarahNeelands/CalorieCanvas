import React from "react";
import { useNavigate } from "react-router-dom";
import Modal from '../ui/Modal.jsx';
import { resolveToGrams, unitOptionsForFood } from "../../utils/units";
import { createMealLog } from "../../services/mealLogClient";

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

function getMealPer100g(item) {
  return {
    calories: Number(item.kcal_per_100g || 0),
    protein: Number(item.protein_g_per_100g || 0),
    carbs: Number(item.carbs_g_per_100g || 0),
    fat: Number(item.fat_g_per_100g || 0),
    fiber: Number(item.unit_conversions?.macros_per_100g?.fiber || 0),
    sugar: Number(item.unit_conversions?.macros_per_100g?.sugar || 0),
    cholesterol: Number(item.unit_conversions?.macros_per_100g?.cholesterol || 0),
  };
}

export default function LogMealModal({ open, onClose, userId, item }) {
  const navigate = useNavigate();
  const [whenAt, setWhenAt] = React.useState(new Date().toISOString());
  const [qty, setQty] = React.useState(100);
  const [unit, setUnit] = React.useState("g");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);
  const availableUnits = unitOptionsForFood(item);

  React.useEffect(() => {
    if (open) {
      setWhenAt(new Date().toISOString());
      setQty(100);
      setUnit(availableUnits[0] || "g");
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

      const grams = resolveToGrams({ unit, qty, item });
      const macros = scaleNutrients(grams, getMealPer100g(item));
      const micros = scaleMicros(grams, item.unit_conversions?.micros_per_100g || {});

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
      <form onSubmit={handleSave} className="grid" style={{ gap: 12 }}>
        <label>
          <div className="label">Date & Time</div>
          <input
            type="datetime-local"
            value={new Date(whenAt).toISOString().slice(0,16)}
            onChange={(e) => {
              const local = e.target.value;
              const iso = new Date(local).toISOString();
              setWhenAt(iso);
            }}
          />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ flex: 1 }}>
            <div className="label">Amount</div>
            <input type="number" min={0} step="any" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </label>
          <label style={{ width: 160 }}>
            <div className="label">Unit</div>
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {availableUnits.map((u) => (<option key={u} value={u}>{u}</option>))}
            </select>
          </label>
        </div>
        {error && <div style={{ color: "#b00020" }}>{String(error.message || error)}</div>}
        <div className="row-between" style={{ gap: 8, marginTop: 8 }}>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-solid" disabled={saving}>{saving ? "Saving…" : "Log"}</button>
        </div>
      </form>
    </Modal>
  );
}
