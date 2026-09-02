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

function normalizedType(item) {
  return item?.item_type || item?.type || "ingredient";
}

export function getServingSize(item) {
  return item?.unit_conversions?.serving_size || null;
}

export function getDefaultCatalogUsage(item) {
  if (normalizedType(item) === "meal" && Number(item?.unit_conversions?.quantity) > 0) {
    return { qty: "", unit: "serving" };
  }

  const serving = getServingSize(item);
  return { qty: "", unit: serving?.unit || "g" };
}

export function availableCatalogUnits(item) {
  const units = new Set(["g", "mg", "oz", "lb"]);
  for (const unit of ["ml", "cup", "tbsp", "tsp", "piece"]) {
    if (Number(item?.unit_conversions?.[unit] || 0) > 0) units.add(unit);
  }
  if (Number(item?.unit_conversions?.quantity) > 0) units.add("serving");
  const serving = getServingSize(item);
  if (serving?.unit) units.add(serving.unit);
  return Array.from(units);
}

export function catalogUsageWeightGrams(item, qty, unit) {
  const numericQty = Number(qty || 0);
  if (!(numericQty > 0)) return 0;

  const normalizedUnit = String(unit || "").trim().toLowerCase();
  if (normalizedUnit === "serving") {
    const gramsPerServing = Number(item?.unit_conversions?.quantity || 0);
    if (gramsPerServing > 0) return numericQty * gramsPerServing;
  }

  const customGramsPerUnit = Number(item?.unit_conversions?.[normalizedUnit] || 0);
  if (customGramsPerUnit > 0) return numericQty * customGramsPerUnit;
  if (MASS_UNIT_TO_GRAMS[normalizedUnit]) return numericQty * MASS_UNIT_TO_GRAMS[normalizedUnit];
  return 0;
}

function comparableAmount(item, qty, unit) {
  const grams = catalogUsageWeightGrams(item, qty, unit);
  if (grams > 0) return { value: grams, kind: "mass" };
  if (VOLUME_UNIT_TO_ML[unit]) return { value: Number(qty || 0) * VOLUME_UNIT_TO_ML[unit], kind: "volume" };
  if (unit === "piece") return { value: Number(qty || 0), kind: "count" };
  return null;
}

function servingRatio(item, qty, unit) {
  const serving = getServingSize(item);
  if (!serving?.qty || !serving?.unit) return unit === "g" ? (Number(qty) || 0) / 100 : 0;
  const actual = comparableAmount(item, qty, unit);
  const base = comparableAmount(item, serving.qty, serving.unit);
  if (actual && base && actual.kind === base.kind && base.value > 0) return actual.value / base.value;
  if (unit === serving.unit) return (Number(qty) || 0) / Number(serving.qty);
  return 0;
}

function per100gMacro(item, key) {
  const columns = {
    calories: "kcal_per_100g",
    protein: "protein_g_per_100g",
    carbs: "carbs_g_per_100g",
    fat: "fat_g_per_100g",
  };
  if (columns[key]) return Number(item?.[columns[key]] || 0);
  return Number(item?.unit_conversions?.macros_per_100g?.[key] || 0);
}

export function calculateCatalogMacro(item, qty, unit, key) {
  const weight = catalogUsageWeightGrams(item, qty, unit);
  const per100g = per100gMacro(item, key);
  if (weight > 0 && (normalizedType(item) === "meal" || per100g > 0)) {
    return per100g * (weight / 100);
  }
  const servingValue = item?.unit_conversions?.macros?.[key];
  return typeof servingValue === "number" ? servingValue * servingRatio(item, qty, unit) : 0;
}

export function calculateCatalogMicro(item, qty, unit, key) {
  const weight = catalogUsageWeightGrams(item, qty, unit);
  const per100g = Number(item?.unit_conversions?.micros_per_100g?.[key] || 0);
  if (weight > 0 && (normalizedType(item) === "meal" || per100g > 0)) {
    return per100g * (weight / 100);
  }
  const servingValue = item?.unit_conversions?.micros?.[key]?.value;
  return typeof servingValue === "number" ? servingValue * servingRatio(item, qty, unit) : 0;
}
