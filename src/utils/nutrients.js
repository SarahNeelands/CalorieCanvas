export function computeTotalsFrom100g({ grams, per100g }) {
  const factor = (Number(grams) || 0) / 100;
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  return {
    kcal: round2((per100g.kcal || 0) * factor),
    protein_g: round2((per100g.protein_g || 0) * factor),
    carbs_g: round2((per100g.carbs_g || 0) * factor),
    fat_g: round2((per100g.fat_g || 0) * factor),
  };
}

const DAILY_VALUE_EQUIVALENTS = {
  sodium: { value: 2300, unit: "mg" },
  potassium: { value: 4700, unit: "mg" },
  calcium: { value: 1300, unit: "mg" },
  iron: { value: 18, unit: "mg" },
  vitaminA: { value: 900, unit: "mcg" },
  vitaminC: { value: 90, unit: "mg" },
};

export function toMassValue(value, unit, nutrientKey = "") {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return 0;

  const normalizedUnit = String(unit || "mg").trim().toLowerCase();
  if (normalizedUnit === "mg") return numericValue;
  if (normalizedUnit === "g") return numericValue * 1000;
  if (normalizedUnit === "mcg") return nutrientKey === "vitaminA" ? numericValue : numericValue / 1000;
  if (normalizedUnit === "percent_dv") {
    const reference = DAILY_VALUE_EQUIVALENTS[nutrientKey];
    if (!reference) return 0;
    const converted = (numericValue / 100) * reference.value;
    if (reference.unit === "mcg" && nutrientKey !== "vitaminA") {
      return converted / 1000;
    }
    return nutrientKey === "vitaminA" ? converted : converted;
  }
  return numericValue;
}
