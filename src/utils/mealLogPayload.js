import { toMassValue } from "./nutrients";
import { resolveToGrams } from "./units";

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function scalePer100gValue(value, grams) {
  return round2((Number(value || 0) * Number(grams || 0)) / 100);
}

function servingUnitToGrams(qty, unit, item) {
  const numericQty = Number(qty || 0);
  if (!(numericQty > 0)) return null;
  const normalizedUnit = String(unit || "g").trim().toLowerCase();
  const customGramsPerUnit = Number(item?.unit_conversions?.[normalizedUnit] || 0);
  if (customGramsPerUnit > 0) return numericQty * customGramsPerUnit;
  const gramsByUnit = {
    mg: 0.001, g: 1, oz: 28.3495, lb: 453.592,
    ml: 1, cup: 236.588, tbsp: 14.7868, tsp: 4.92892,
  };
  return gramsByUnit[normalizedUnit] ? numericQty * gramsByUnit[normalizedUnit] : null;
}

function derivePer100gFromServing(value, item) {
  const serving = item?.unit_conversions?.serving_size;
  const gramsPerServing = servingUnitToGrams(serving?.qty, serving?.unit, item);
  return gramsPerServing > 0 ? Number(value || 0) * (100 / gramsPerServing) : 0;
}

function getMacroPer100g(item, key) {
  const per100g = item?.unit_conversions?.macros_per_100g;
  if (typeof per100g?.[key] === "number") return Number(per100g[key] || 0);
  const servingMacros = item?.unit_conversions?.macros;
  if (typeof servingMacros?.[key] === "number") {
    return derivePer100gFromServing(servingMacros[key], item);
  }
  return 0;
}

function getMicroPer100g(item, key) {
  const per100g = item?.unit_conversions?.micros_per_100g;
  if (typeof per100g?.[key] === "number") return Number(per100g[key] || 0);
  const servingMicros = item?.unit_conversions?.micros;
  if (servingMicros?.[key]?.value !== undefined && servingMicros?.[key]?.value !== null) {
    return derivePer100gFromServing(
      toMassValue(servingMicros[key].value, servingMicros[key].unit, key),
      item
    );
  }
  return 0;
}

export function buildMealLogPayload({ item, loggedAt = new Date(), qty, unit }) {
  const when = loggedAt instanceof Date ? loggedAt : new Date(loggedAt);
  const grams = resolveToGrams({ unit, qty, item });
  const macros = {
    kcal: scalePer100gValue(item?.kcal_per_100g, grams),
    protein_g: scalePer100gValue(item?.protein_g_per_100g, grams),
    carbs_g: scalePer100gValue(item?.carbs_g_per_100g, grams),
    fat_g: scalePer100gValue(item?.fat_g_per_100g, grams),
    fiber_g: scalePer100gValue(getMacroPer100g(item, "fiber"), grams),
    sugar_g: scalePer100gValue(getMacroPer100g(item, "sugar"), grams),
    cholesterol_mg: scalePer100gValue(getMacroPer100g(item, "cholesterol"), grams),
  };
  const micros = {
    sodium: scalePer100gValue(getMicroPer100g(item, "sodium"), grams),
    potassium: scalePer100gValue(getMicroPer100g(item, "potassium"), grams),
    calcium: scalePer100gValue(getMicroPer100g(item, "calcium"), grams),
    iron: scalePer100gValue(getMicroPer100g(item, "iron"), grams),
    vitaminA: scalePer100gValue(getMicroPer100g(item, "vitaminA"), grams),
    vitaminC: scalePer100gValue(getMicroPer100g(item, "vitaminC"), grams),
  };

  return {
    meal_id: item.id,
    food_id: item.food_id ?? null,
    item_snapshot: item,
    qty: Number(qty),
    unit_code: unit,
    grams_resolved: grams,
    logged_at: when.toISOString(),
    meal_type: (item.type || item.item_type) === "snack" ? "snack" : "other",
    ...macros,
    micros,
  };
}

export function getFoodUnitLabel(item, unit) {
  if (unit !== "quantity") return unit;
  return item?.unit_conversions?.quantity_label || "serving";
}

