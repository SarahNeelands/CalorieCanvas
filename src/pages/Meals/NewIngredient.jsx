import React, { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import NavBar from "../../components/NavBar";
import { createCatalogItem, updateCatalogItem } from "../../services/catalogClient";
import { scanNutritionLabelFromImage } from "../../utils/nutritionLabelOcr";
import { toMassValue } from "../../utils/nutrients";

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

const MASS_EQUIVALENTS = {
  mg: 0.001,
  g: 1,
  ml: 1,
  oz: 28.3495,
  lb: 453.592,
  cup: 236.588,
  tbsp: 14.7868,
  tsp: 4.92892,
};

function Section({ title, children }) {
  return (
    <section style={{
      background: "#fffdf7",
      border: "1px solid rgba(22,50,39,0.12)",
      borderRadius: 18,
      padding: 20,
      display: "grid",
      gap: 16,
      overflow: "hidden",
      minWidth: 0,
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
    maxWidth: "100%",
    minWidth: 0,
    border: "1px solid rgba(22,50,39,0.18)",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 15,
    background: "#fff",
    boxSizing: "border-box",
  };
}

function cleanDecimalInput(value) {
  return (value ?? "").replace(/[^0-9.]/g, "");
}

function getServingGrams(qty, unit) {
  const numericQty = Number(qty || 0);
  const gramsPerUnit = MASS_EQUIVALENTS[String(unit || "").trim().toLowerCase()];
  if (!(numericQty > 0) || !gramsPerUnit) return null;
  return numericQty * gramsPerUnit;
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read photo."));
    reader.readAsDataURL(file);
  });
}

export default function NewIngredientPage({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = location.state?.returnTo || "/meals/new";
  const existingIngredient = location.state?.ingredient || null;
  const existingServing = existingIngredient?.unit_conversions?.serving_size || {};
  const existingMacros = existingIngredient?.unit_conversions?.macros || {};
  const existingMicros = existingIngredient?.unit_conversions?.micros || {};
  const existingPhoto = existingIngredient?.unit_conversions?.photo_data_url || "";
  const isEditing = Boolean(existingIngredient?.id);
  const photoInputRef = useRef(null);
  const [name, setName] = useState(existingIngredient?.title || "");
  const [brand, setBrand] = useState(existingIngredient?.unit_conversions?.brand || "");
  const [photoDataUrl, setPhotoDataUrl] = useState(existingPhoto);
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
  const [scanningPhoto, setScanningPhoto] = useState(false);

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

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setScanningPhoto(true);
      setMsg("Reading nutrition label...");
      const dataUrl = await readImageAsDataUrl(file);
      setPhotoDataUrl(dataUrl);
      const parsed = await scanNutritionLabelFromImage(dataUrl);

      if (parsed?.serving?.qty) {
        setServingSize(String(parsed.serving.qty));
      }
      if (parsed?.serving?.unit) {
        setServingUnit(parsed.serving.unit);
      }

      setMacros((current) => ({
        ...current,
        calories: parsed?.macros?.calories != null ? String(parsed.macros.calories) : current.calories,
        protein: parsed?.macros?.protein != null ? String(parsed.macros.protein) : current.protein,
        carbs: parsed?.macros?.carbs != null ? String(parsed.macros.carbs) : current.carbs,
        fat: parsed?.macros?.fat != null ? String(parsed.macros.fat) : current.fat,
        fiber: parsed?.macros?.fiber != null ? String(parsed.macros.fiber) : current.fiber,
        sugar: parsed?.macros?.sugar != null ? String(parsed.macros.sugar) : current.sugar,
        cholesterol: parsed?.macros?.cholesterol != null ? String(parsed.macros.cholesterol) : current.cholesterol,
      }));

      setMicros((current) => ({
        ...current,
        sodium: parsed?.micros?.sodium ? { value: String(parsed.micros.sodium.value), unit: parsed.micros.sodium.unit } : current.sodium,
        potassium: parsed?.micros?.potassium ? { value: String(parsed.micros.potassium.value), unit: parsed.micros.potassium.unit } : current.potassium,
        calcium: parsed?.micros?.calcium ? { value: String(parsed.micros.calcium.value), unit: parsed.micros.calcium.unit } : current.calcium,
        iron: parsed?.micros?.iron ? { value: String(parsed.micros.iron.value), unit: parsed.micros.iron.unit } : current.iron,
        vitaminA: parsed?.micros?.vitaminA ? { value: String(parsed.micros.vitaminA.value), unit: parsed.micros.vitaminA.unit } : current.vitaminA,
        vitaminC: parsed?.micros?.vitaminC ? { value: String(parsed.micros.vitaminC.value), unit: parsed.micros.vitaminC.unit } : current.vitaminC,
      }));

      setMsg("Nutrition label scanned. Review the values before saving.");
    } catch (error) {
      setMsg(error.message || "Failed to load photo.");
    } finally {
      setScanningPhoto(false);
    }
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
      const servingGrams = getServingGrams(payload.servingSize, payload.servingUnit);
      const toPer100g = (value) => {
        const numericValue = Number(value || 0);
        if (!(servingGrams > 0)) return numericValue;
        return numericValue * (100 / servingGrams);
      };

      const macrosPer100g = {
        calories: toPer100g(payload.macros.calories),
        protein: toPer100g(payload.macros.protein),
        carbs: toPer100g(payload.macros.carbs),
        fat: toPer100g(payload.macros.fat),
        fiber: toPer100g(payload.macros.fiber),
        sugar: toPer100g(payload.macros.sugar),
        cholesterol: toPer100g(payload.macros.cholesterol),
      };

      const microsPer100g = Object.fromEntries(
        Object.entries(payload.micros).map(([key, value]) => [key, toPer100g(toMassValue(value.value, value.unit, key))])
      );

      const normalizedMicros = Object.fromEntries(
        Object.entries(payload.micros).map(([key, value]) => {
          const numericValue = toMassValue(value.value, value.unit, key);
          const unit = key === "vitaminA" ? "mcg" : "mg";
          return [key, { value: Number(numericValue.toFixed(2)), unit }];
        })
      );

      const catalogPayload = {
        title: payload.title,
        item_type: "ingredient",
        kcal_per_100g: Number(macrosPer100g.calories.toFixed(2)),
        protein_g_per_100g: Number(macrosPer100g.protein.toFixed(2)),
        carbs_g_per_100g: Number(macrosPer100g.carbs.toFixed(2)),
        fat_g_per_100g: Number(macrosPer100g.fat.toFixed(2)),
        unit_conversions: {
          brand: payload.brand,
          photo_data_url: photoDataUrl || null,
          serving_size: {
            qty: payload.servingSize,
            unit: payload.servingUnit,
          },
          macros: payload.macros,
          macros_per_100g: {
            fiber: Number(macrosPer100g.fiber.toFixed(2)),
            sugar: Number(macrosPer100g.sugar.toFixed(2)),
            cholesterol: Number(macrosPer100g.cholesterol.toFixed(2)),
          },
          micros: normalizedMicros,
          micros_per_100g: Object.fromEntries(
            Object.entries(microsPer100g).map(([key, value]) => [key, Number(value.toFixed(2))])
          ),
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
        background: "transparent",
        padding: "32px 20px 48px",
      }}
    >
      <NavBar profileImageSrc={user?.avatar} />
      <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gap: 20 }}>
        <header className="cc-page-heading">
          <h2 className="cc-page-title">
            {isEditing ? "Edit Ingredient" : "New Ingredient"}
          </h2>
          <p className="cc-page-subtitle">
            {isEditing
              ? "Update the nutrient profile and serving details for this ingredient."
              : "Add the full nutrient profile and the serving size those values refer to."}
          </p>
        </header>

        <Section title="Ingredient Details">
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", minWidth: 0 }}>
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

          <Field label="Photo" hint="Take a picture or upload one from your phone.">
            <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ display: "none" }}
              />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  style={{
                    borderRadius: 999,
                    padding: "12px 18px",
                    background: "#163227",
                    color: "#fff",
                    border: 0,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {scanningPhoto ? "Reading Photo..." : "Upload Photo"}
                </button>
                {photoDataUrl ? (
                  <button
                    type="button"
                    onClick={() => setPhotoDataUrl("")}
                    style={{
                      borderRadius: 999,
                      padding: "12px 18px",
                      background: "transparent",
                      color: "#163227",
                      border: "1px solid rgba(22,50,39,0.18)",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Remove Photo
                  </button>
                ) : null}
              </div>
              {photoDataUrl ? (
                <img
                  src={photoDataUrl}
                  alt="Ingredient preview"
                  style={{
                    width: "100%",
                    maxWidth: 220,
                    aspectRatio: "1 / 1",
                    objectFit: "cover",
                    borderRadius: 16,
                    border: "1px solid rgba(22,50,39,0.12)",
                  }}
                />
              ) : null}
            </div>
          </Field>
        </Section>

        <Section title="Serving Size">
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", minWidth: 0 }}>
            <Field label="Serving Size" hint="What nutrition values below refer to.">
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, minWidth: 0 }}>
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
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", minWidth: 0 }}>
            {MACRO_FIELDS.map((field) => (
              <Field key={field.key} label={field.label}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", minWidth: 0 }}>
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
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", minWidth: 0 }}>
            {MICRO_FIELDS.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                hint="Enter mg, g, or % daily value. Conversion can be derived later."
              >
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, minWidth: 0 }}>
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
