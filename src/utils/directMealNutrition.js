import { toMassValue } from "./nutrients";

export const MEAL_MACRO_FIELDS = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "fiber", label: "Fiber", unit: "g" },
  { key: "sugar", label: "Sugar", unit: "g" },
  { key: "cholesterol", label: "Cholesterol", unit: "mg" },
];

export const MEAL_MICRO_FIELDS = [
  { key: "sodium", label: "Sodium", units: ["mg", "percent_dv"] },
  { key: "potassium", label: "Potassium", units: ["mg", "percent_dv"] },
  { key: "calcium", label: "Calcium", units: ["mg", "percent_dv"] },
  { key: "iron", label: "Iron", units: ["mg", "percent_dv"] },
  { key: "vitaminA", label: "Vitamin A", units: ["percent_dv", "mcg"] },
  { key: "vitaminC", label: "Vitamin C", units: ["mg", "percent_dv"] },
];

export function emptyMealMacros() {
  return MEAL_MACRO_FIELDS.reduce((acc, field) => {
    acc[field.key] = "";
    return acc;
  }, {});
}

export function emptyMealMicros() {
  return MEAL_MICRO_FIELDS.reduce((acc, field) => {
    acc[field.key] = { value: "", unit: field.units[0] };
    return acc;
  }, {});
}

export function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function cleanDecimal(value) {
  return (value ?? "").replace(/[^0-9.]/g, "");
}

export function servingUnitToGrams(qty, unit) {
  const numericQty = Number(qty || 0);
  if (!(numericQty > 0)) return null;

  const gramsByUnit = {
    mg: 0.001,
    g: 1,
    ml: 1,
    oz: 28.3495,
    lb: 453.592,
  };
  const gramsPerUnit = gramsByUnit[String(unit || "g").trim().toLowerCase()];
  return gramsPerUnit ? numericQty * gramsPerUnit : null;
}

export function parsedMealNutritionPatch(parsed) {
  const macros = Object.fromEntries(
    MEAL_MACRO_FIELDS
      .filter((field) => parsed?.macros?.[field.key] != null)
      .map((field) => [field.key, String(parsed.macros[field.key])])
  );
  const micros = Object.fromEntries(
    MEAL_MICRO_FIELDS
      .filter((field) => parsed?.micros?.[field.key]?.value != null)
      .map((field) => [
        field.key,
        {
          value: String(parsed.micros[field.key].value),
          unit: parsed.micros[field.key].unit,
        },
      ])
  );
  const servingGrams = servingUnitToGrams(parsed?.serving?.qty, parsed?.serving?.unit);

  return {
    macros,
    micros,
    totalWeight: servingGrams ? String(round2(servingGrams)) : "",
    servingCount: parsed?.serving?.count ? String(parsed.serving.count) : "",
    recognizedCount:
      Object.keys(macros).length +
      Object.keys(micros).length +
      (servingGrams ? 1 : 0) +
      (parsed?.serving?.count ? 1 : 0),
  };
}

export function buildDirectMealCatalogPayload({
  mealName,
  timestamp,
  totalWeight,
  servingCount,
  macros,
  micros,
}) {
  const title = String(mealName || "").trim();
  const numericTotalWeight = Number(totalWeight || 0);
  const numericServingCount = Number(servingCount || 0);

  if (!title) throw new Error("Enter a meal name before saving.");
  if (!(numericTotalWeight > 0)) {
    throw new Error("Enter the weight that the pasted nutrition values refer to.");
  }

  const parsedMacros = Object.fromEntries(
    Object.entries({ ...emptyMealMacros(), ...macros }).map(([key, value]) => [key, Number(value) || 0])
  );
  const parsedMicros = Object.fromEntries(
    Object.entries({ ...emptyMealMicros(), ...micros }).map(([key, value]) => [
      key,
      { value: Number(value?.value) || 0, unit: value?.unit || emptyMealMicros()[key]?.unit || "mg" },
    ])
  );

  if (!(parsedMacros.calories > 0)) {
    throw new Error("Enter calories for the meal nutrition values.");
  }

  const scale = 100 / numericTotalWeight;
  const gramsPerServing = numericServingCount > 0 ? numericTotalWeight / numericServingCount : null;
  const per100gMacros = {
    calories: parsedMacros.calories * scale,
    protein: parsedMacros.protein * scale,
    carbs: parsedMacros.carbs * scale,
    fat: parsedMacros.fat * scale,
    fiber: parsedMacros.fiber * scale,
    sugar: parsedMacros.sugar * scale,
    cholesterol: parsedMacros.cholesterol * scale,
  };
  const normalizedMicros = Object.fromEntries(
    Object.entries(parsedMicros).map(([key, value]) => {
      const normalizedValue = toMassValue(value.value, value.unit, key);
      return [key, { value: round2(normalizedValue), unit: key === "vitaminA" ? "mcg" : "mg" }];
    })
  );
  const microsPer100g = Object.fromEntries(
    Object.entries(parsedMicros).map(([key, value]) => [
      key,
      toMassValue(value.value, value.unit, key) * scale,
    ])
  );

  return {
    title,
    item_type: "meal",
    created_at: timestamp ? new Date(timestamp).toISOString() : undefined,
    kcal_per_100g: round2(per100gMacros.calories),
    protein_g_per_100g: round2(per100gMacros.protein),
    carbs_g_per_100g: round2(per100gMacros.carbs),
    fat_g_per_100g: round2(per100gMacros.fat),
    unit_conversions: {
      quantity: gramsPerServing ? round2(gramsPerServing) : null,
      quantity_label: gramsPerServing ? "serving" : null,
      macros: parsedMacros,
      macros_per_100g: {
        fiber: round2(per100gMacros.fiber),
        sugar: round2(per100gMacros.sugar),
        cholesterol: round2(per100gMacros.cholesterol),
      },
      micros: normalizedMicros,
      micros_per_100g: Object.fromEntries(
        Object.entries(microsPer100g).map(([key, value]) => [key, round2(value)])
      ),
      serving_size: {
        qty: gramsPerServing ? round2(gramsPerServing) : round2(numericTotalWeight),
        unit: gramsPerServing ? "serving" : "g",
      },
      total_weight_g: round2(numericTotalWeight),
      servings_count: numericServingCount > 0 ? round2(numericServingCount) : null,
      ingredients: [],
      direct_nutrition: true,
    },
  };
}
