import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "../../components/NavBar";
import { createCatalogItem } from "../../services/catalogClient";
import { scanNutritionLabelFromImage } from "../../utils/nutritionLabelOcr";

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
  { key: "sodium", label: "Sodium", units: ["mg", "percent_dv"] },
  { key: "potassium", label: "Potassium", units: ["mg", "percent_dv"] },
  { key: "calcium", label: "Calcium", units: ["mg", "percent_dv"] },
  { key: "iron", label: "Iron", units: ["mg", "percent_dv"] },
  { key: "vitaminA", label: "Vitamin A", units: ["percent_dv"] },
  { key: "vitaminC", label: "Vitamin C", units: ["mg", "percent_dv"] },
];

const DEFAULT_MACROS = MACRO_FIELDS.reduce((acc, field) => {
  acc[field.key] = "";
  return acc;
}, {});

const DEFAULT_MICROS = MICRO_FIELDS.reduce((acc, field) => {
  acc[field.key] = { value: "", unit: field.units[0] };
  return acc;
}, {});

function cleanDecimal(value) {
  return (value ?? "").replace(/[^0-9.]/g, "");
}

function inputStyle() {
  return {
    width: "100%",
    border: "1px solid rgba(22,50,39,0.18)",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 15,
    background: "#fff",
    boxSizing: "border-box",
  };
}

function selectStyle() {
  return {
    ...inputStyle(),
    minWidth: 0,
    width: "100%",
    padding: "12px 14px",
    color: "#243E2D",
    fontSize: 15,
    fontFamily: "inherit",
    appearance: "none",
  };
}

function Section({ title, children }) {
  return (
    <section
      style={{
        background: "#fffdf7",
        border: "1px solid rgba(22,50,39,0.12)",
        borderRadius: 18,
        padding: 20,
        display: "grid",
        gap: 16,
      }}
    >
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
      {hint ? <span style={{ fontSize: 12, color: "#5f6f64" }}>{hint}</span> : null}
    </label>
  );
}

function microFieldRowStyle() {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(4.75rem, 5.5rem)",
    gap: 10,
    alignItems: "start",
  };
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read photo."));
    reader.readAsDataURL(file);
  });
}

export default function SnackDetails({ user }) {
  const navigate = useNavigate();
  const photoInputRef = useRef(null);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [servingWeight, setServingWeight] = useState("");
  const [servingCount, setServingCount] = useState("");
  const [snackLabel, setSnackLabel] = useState("snack");
  const [macros, setMacros] = useState(DEFAULT_MACROS);
  const [micros, setMicros] = useState(DEFAULT_MICROS);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [scanningPhoto, setScanningPhoto] = useState(false);

  function updateMacro(key, value) {
    setMacros((current) => ({ ...current, [key]: cleanDecimal(value) }));
  }

  function updateMicroValue(key, value) {
    setMicros((current) => ({
      ...current,
      [key]: { ...current[key], value: cleanDecimal(value) },
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
        setServingWeight(String(parsed.serving.qty));
      }
      if (parsed?.serving?.count) {
        setServingCount(String(parsed.serving.count));
      }
      if (parsed?.serving?.countLabel) {
        setSnackLabel(parsed.serving.countLabel);
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
    const trimmedName = name.trim();
    const numericServingWeight = Number(servingWeight);
    const numericServingCount = Number(servingCount);
    const parsedMacros = Object.fromEntries(
      Object.entries(macros).map(([key, value]) => [key, Number(value) || 0])
    );
    const parsedMicros = Object.fromEntries(
      Object.entries(micros).map(([key, value]) => [key, { value: Number(value.value) || 0, unit: value.unit }])
    );

    if (!trimmedName) {
      setMsg("Snack name is required.");
      return;
    }

    if (!(parsedMacros.calories > 0)) {
      setMsg("Enter valid calories.");
      return;
    }

    if (!(numericServingWeight > 0)) {
      setMsg("Enter the serving weight from the package.");
      return;
    }

    if (!(numericServingCount > 0)) {
      setMsg("Enter how many snacks are in that serving.");
      return;
    }

    const gramsPerSnack = numericServingWeight / numericServingCount;
    const ratioTo100g = 100 / numericServingWeight;
    const per100gMacros = {
      calories: parsedMacros.calories * ratioTo100g,
      protein: parsedMacros.protein * ratioTo100g,
      carbs: parsedMacros.carbs * ratioTo100g,
      fat: parsedMacros.fat * ratioTo100g,
      fiber: parsedMacros.fiber * ratioTo100g,
      sugar: parsedMacros.sugar * ratioTo100g,
      cholesterol: parsedMacros.cholesterol * ratioTo100g,
    };
    const microsPer100g = Object.fromEntries(
      Object.entries(parsedMicros).map(([key, value]) => [key, Number(value.value || 0) * ratioTo100g])
    );

    try {
      setSaving(true);
      setMsg(null);

      await createCatalogItem({
        title: trimmedName,
        item_type: "snack",
        kcal_per_100g: Number(per100gMacros.calories.toFixed(2)),
        protein_g_per_100g: Number(per100gMacros.protein.toFixed(2)),
        carbs_g_per_100g: Number(per100gMacros.carbs.toFixed(2)),
        fat_g_per_100g: Number(per100gMacros.fat.toFixed(2)),
        unit_conversions: {
          brand: brand.trim() || null,
          photo_data_url: photoDataUrl || null,
          quantity: Number(gramsPerSnack.toFixed(2)),
          quantity_label: snackLabel.trim() || "snack",
          serving_size: {
            qty: Number(numericServingWeight.toFixed(2)),
            unit: "g",
          },
          package_serving: {
            qty: Number(numericServingWeight.toFixed(2)),
            unit: "g",
            count: Number(numericServingCount.toFixed(2)),
            count_label: snackLabel.trim() || "snack",
          },
          macros_per_100g: {
            fiber: Number(per100gMacros.fiber.toFixed(2)),
            sugar: Number(per100gMacros.sugar.toFixed(2)),
            cholesterol: Number(per100gMacros.cholesterol.toFixed(2)),
          },
          micros_per_100g: Object.fromEntries(
            Object.entries(microsPer100g).map(([key, value]) => [key, Number(value.toFixed(2))])
          ),
          micros: parsedMicros,
        },
      });

      navigate("/meals");
    } catch (error) {
      setMsg(error.message || "Failed to save snack.");
    } finally {
      setSaving(false);
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
      <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 20 }}>
        <header className="cc-page-heading">
          <h2 className="cc-page-title">
            New Snack
          </h2>
          <p className="cc-page-subtitle">
            Enter the serving details exactly like the package label, then log it later by grams or by snack count.
          </p>
        </header>

        <Section title="Snack Details">
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <Field label="Snack Name">
              <input
                style={inputStyle()}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Chocolate Chip Cookie"
              />
            </Field>

            <Field label="Brand Name">
              <input
                style={inputStyle()}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Chips Ahoy"
              />
            </Field>

            <Field label="Count Label" hint='Used when logging by count, for example "cookie" or "cracker".'>
              <input
                style={inputStyle()}
                value={snackLabel}
                onChange={(e) => setSnackLabel(e.target.value)}
                placeholder="snack"
              />
            </Field>
          </div>

          <Field label="Photo" hint="Take a picture or upload one from your phone.">
            <div style={{ display: "grid", gap: 12 }}>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
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
                  alt="Snack preview"
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

        <Section title="Serving Details">
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <Field
                label="Serving Weight"
                hint="Use the package serving weight, for example 85g."
              >
                <input
                  style={inputStyle()}
                  type="text"
                  inputMode="decimal"
                  value={servingWeight}
                  onChange={(e) => setServingWeight(cleanDecimal(e.target.value))}
                  placeholder="85"
                />
              </Field>

              <Field
                label={`Number of ${snackLabel.trim() || "snacks"} in That Serving`}
                hint="For example, if the label says 3 cookies per serving, enter 3."
              >
                <input
                  style={inputStyle()}
                  type="text"
                  inputMode="decimal"
                  value={servingCount}
                  onChange={(e) => setServingCount(cleanDecimal(e.target.value))}
                  placeholder="3"
                />
              </Field>
            </div>
          </div>
        </Section>

        <Section title="Nutrition Per Serving">
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              {MACRO_FIELDS.map((field) => (
                <Field
                  key={field.key}
                  label={field.label}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
                    <input
                      style={inputStyle()}
                      type="text"
                      inputMode="decimal"
                      value={macros[field.key]}
                      onChange={(e) => updateMacro(field.key, e.target.value)}
                      placeholder="0"
                    />
                    <span style={{ color: "#516257", fontWeight: 700 }}>{field.unit}</span>
                  </div>
                </Field>
              ))}
            </div>

            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {MICRO_FIELDS.map((field) => (
                <Field
                  key={field.key}
                  label={field.label}
                  hint="Enter the package value for that serving."
                >
                  <div style={microFieldRowStyle()}>
                    <input
                      style={inputStyle()}
                      type="text"
                      inputMode="decimal"
                      value={micros[field.key].value}
                      onChange={(e) => updateMicroValue(field.key, e.target.value)}
                      placeholder="0"
                    />
                    <select
                      style={selectStyle()}
                      value={micros[field.key].unit}
                      onChange={(e) => updateMicroUnit(field.key, e.target.value)}
                    >
                      {field.units.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit === "percent_dv" ? "% DV" : "mg"}
                        </option>
                      ))}
                    </select>
                  </div>
                </Field>
              ))}
            </div>
          </div>
        </Section>

        {msg ? (
          <div
            style={{
              color: "#8c1d18",
              background: "#fff1ef",
              border: "1px solid rgba(140,29,24,0.15)",
              borderRadius: 12,
              padding: "12px 14px",
            }}
          >
            {msg}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
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
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Snack"}
          </button>

          <button
            type="button"
            onClick={() => navigate(-1)}
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
