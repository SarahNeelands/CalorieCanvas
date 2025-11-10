import React from "react";
import { supabase } from "../../supabaseClient";
import Modal from '../ui/Modal.jsx';
import { resolveToGrams, unitOptionsForFood } from "../../utils/units";
import { computeTotalsFrom100g } from "../../utils/nutrients";

export default function LogMealModal({ open, onClose, userId, item }) {
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
      const totals = computeTotalsFrom100g({
        grams,
        per100g: {
          kcal: Number(item.kcal_per_100g || 0),
          protein_g: Number(item.protein_g_per_100g || 0),
          carbs_g: Number(item.carbs_g_per_100g || 0),
          fat_g: Number(item.fat_g_per_100g || 0),
        },
      });

      const payload = {
        user_id: userId,
        meal_id: item.id,
        food_id: item.food_id ?? null,
        qty,
        unit_code: unit,
        grams_resolved: grams,
        logged_at: whenAt,
        kcal: totals.kcal,
        protein_g: totals.protein_g,
        carbs_g: totals.carbs_g,
        fat_g: totals.fat_g,
      };

      const { error } = await supabase.from("meal_logs").insert(payload);
      if (error) throw error;
      window.dispatchEvent(new CustomEvent("meal-logged", { detail: { payload } }));
      onClose?.();
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
