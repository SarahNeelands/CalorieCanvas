import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createCatalogItem, updateCatalogItem } from "../../services/catalogClient";

const MACRO_FIELDS = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "fiber", label: "Fiber", unit: "g" },
  { key: "sugar", label: "Sugar", unit: "g" },
  { key: "cholesterol", label: "Cholesterol", unit: "mg" },
];

const MICRO_FIELDS = [
  { key: "sodium", label: "Sodium" },
  { key: "potassium", label: "Potassium" },
  { key: "calcium", label: "Calcium" },
  { key: "iron", label: "Iron" },
  { key: "vitaminA", label: "Vitamin A" },
  { key: "vitaminC", label: "Vitamin C" },
];

const DEFAULT_MICROS = MICRO_FIELDS.reduce((acc, field) => {
  acc[field.key] = { value: "", unit: "mg" };
  return acc;
}, {});

const DEFAULT_MACROS = MACRO_FIELDS.reduce((acc, field) => {
  acc[field.key] = "";
  return acc;
}, {});

const SERVING_UNITS = ["g", "mg", "ml", "oz", "lb", "cup", "tbsp", "tsp", "piece"];

function Section({ title, children }) {
  return (
    <section style={{
      background: "#fffdf7",
      border: "1px solid rgba(22,50,39,0.12)",
      borderRadius: 18,
      padding: 20,
      display: "grid",
      gap: 16,
    }}>
      <h3 style={{ margin: 0, color: "#163227" }}>{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children, hint }) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span style={{ fontWeight: 600, color: "#243E2D" }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 12, color: "#5f6f64" }}>{hint}</span>}
    </label>
  );
}

function baseInputStyle() {
  return {
    width: "100%",
    border: "1px solid rgba(22,50,39,0.18)",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 15,
    background: "#fff",
  };
}

function cleanDecimalInput(value) {
  return (value ?? "").replace(/[^0-9.]/g, "");
}

export default function NewIngredientPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = location.state?.returnTo || "/meals/new";
  const existingIngredient = location.state?.ingredient || null;
  const existingServing = existingIngredient?.unit_conversions?.serving_size || {};
  const existingMacros = existingIngredient?.unit_conversions?.macros || {};
  const existingMicros = existingIngredient?.unit_conversions?.micros || {};
  const isEditing = Boolean(existingIngredient?.id);
  const [name, setName] = useState(existingIngredient?.title || "");
  const [brand, setBrand] = useState(existingIngredient?.unit_conversions?.brand || "");
  const [servingSize, setServingSize] = useState(
    existingServing.qty === undefined || existingServing.qty === null ? "" : String(existingServing.qty)
  );
  const [servingUnit, setServingUnit] = useState(existingServing.unit || "g");
  const [macros, setMacros] = useState({
    ...DEFAULT_MACROS,
    ...Object.fromEntries(
      Object.entries(existingMacros).map(([key, value]) => [key, value === undefined || value === null ? "" : String(value)])
    ),
  });
  const [micros, setMicros] = useState({
    ...DEFAULT_MICROS,
    ...Object.fromEntries(
      Object.entries(existingMicros).map(([key, value]) => [
        key,
        {
          value: value?.value === undefined || value?.value === null ? "" : String(value.value),
          unit: value?.unit || DEFAULT_MICROS[key]?.unit || "mg",
        },
      ])
    ),
  });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  function updateMacro(key, value) {
    setMacros((current) => ({ ...current, [key]: value }));
  }

  function updateMicroValue(key, value) {
    setMicros((current) => ({
      ...current,
      [key]: { ...current[key], value },
    }));
  }

  function updateMicroUnit(key, unit) {
    setMicros((current) => ({
      ...current,
      [key]: { ...current[key], unit },
    }));
  }

  async function handleSave() {
    if (!name.trim()) {
      setMsg("Ingredient name is required.");
      return;
    }

    if (!servingSize) {
      setMsg("Add a serving size.");
      return;
    }

    setSaving(true);

    const payload = {
      title: name.trim(),
      brand: brand.trim() || null,
      servingSize: Number(servingSize) || 0,
      servingUnit,
      macros: Object.fromEntries(
        Object.entries(macros).map(([key, value]) => [key, Number(value) || 0])
      ),
      micros: Object.fromEntries(
        Object.entries(micros).map(([key, value]) => [key, { value: Number(value.value) || 0, unit: value.unit }])
      ),
    };

    try {
      const catalogPayload = {
        title: payload.title,
        item_type: "ingredient",
        kcal_per_100g: payload.macros.calories,
        protein_g_per_100g: payload.macros.protein,
        carbs_g_per_100g: payload.macros.carbs,
        fat_g_per_100g: payload.macros.fat,
        unit_conversions: {
          brand: payload.brand,
          serving_size: {
            qty: payload.servingSize,
            unit: payload.servingUnit,
          },
          macros: payload.macros,
          micros: payload.micros,
        },
      };

      if (isEditing) {
        await updateCatalogItem(existingIngredient.id, catalogPayload);
      } else {
        await createCatalogItem(catalogPayload);
      }

      setSaving(false);
      navigate(returnTo, {
        replace: true,
        state: { mealDraft: location.state?.mealDraft || null },
      });
    } catch (error) {
      setSaving(false);
      setMsg(error.message || String(error));
    }
  }

  return (
    <main
      className="page form-page"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f6f0e4 0%, #eef4ea 100%)",
        padding: "32px 20px 48px",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gap: 20 }}>
        <header style={{ display: "grid", gap: 8 }}>
          <h2 style={{ margin: 0, color: "#163227", fontSize: "clamp(28px, 3vw, 40px)" }}>
            {isEditing ? "Edit Ingredient" : "New Ingredient"}
          </h2>
          <p style={{ margin: 0, color: "#516257" }}>
            {isEditing
              ? "Update the nutrient profile and serving details for this ingredient."
              : "Add the full nutrient profile and the serving size those values refer to."}
          </p>
        </header>

        <Section title="Ingredient Details">
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <Field label="Ingredient Name">
              <input
                style={baseInputStyle()}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Greek Yogurt"
              />
            </Field>

            <Field label="Brand / Source">
              <input
                style={baseInputStyle()}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Optional"
              />
            </Field>
          </div>
        </Section>

        <Section title="Serving Size">
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <Field label="Serving Size" hint="What nutrition values below refer to.">
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                <input
                  style={baseInputStyle()}
                  type="text"
                  inputMode="decimal"
                  value={servingSize}
                  onChange={(e) => setServingSize(cleanDecimalInput(e.target.value))}
                  placeholder="100"
                />
                <select
                  style={baseInputStyle()}
                  value={servingUnit}
                  onChange={(e) => setServingUnit(e.target.value)}
                >
                  {SERVING_UNITS.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
            </Field>
          </div>
        </Section>

        <Section title="Macros">
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            {MACRO_FIELDS.map((field) => (
              <Field key={field.key} label={field.label}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
                  <input
                    style={baseInputStyle()}
                    type="number"
                    min="0"
                    step="0.01"
                    value={macros[field.key]}
                    onChange={(e) => updateMacro(field.key, e.target.value)}
                    placeholder="0"
                  />
                  <span style={{ color: "#516257", fontWeight: 700 }}>{field.unit}</span>
                </div>
              </Field>
            ))}
          </div>
        </Section>

        <Section title="Micros">
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {MICRO_FIELDS.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                hint="Enter mg, g, or % daily value. Conversion can be derived later."
              >
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                  <input
                    style={baseInputStyle()}
                    type="number"
                    min="0"
                    step="0.01"
                    value={micros[field.key].value}
                    onChange={(e) => updateMicroValue(field.key, e.target.value)}
                    placeholder="0"
                  />
                  <select
                    style={baseInputStyle()}
                    value={micros[field.key].unit}
                    onChange={(e) => updateMicroUnit(field.key, e.target.value)}
                  >
                    <option value="mg">mg</option>
                    <option value="g">g</option>
                    <option value="percent_dv">% DV</option>
                  </select>
                </div>
              </Field>
            ))}
          </div>
        </Section>

        {msg && (
          <div style={{
            color: "#8c1d18",
            background: "#fff1ef",
            border: "1px solid rgba(140,29,24,0.15)",
            borderRadius: 12,
            padding: "12px 14px",
          }}>
            {msg}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={handleSave}
            style={{
              border: 0,
              borderRadius: 999,
              padding: "12px 22px",
              background: "#163227",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Save Ingredient"}
          </button>
          <button
            className="secondary"
            onClick={() => navigate(returnTo, {
              replace: true,
              state: { mealDraft: location.state?.mealDraft || null },
            })}
            style={{
              borderRadius: 999,
              padding: "12px 22px",
              background: "transparent",
              border: "1px solid rgba(22,50,39,0.18)",
              color: "#163227",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </main>
  );
}
