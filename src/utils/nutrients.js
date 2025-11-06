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
