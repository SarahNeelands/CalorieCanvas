const BASE = "https://world.openfoodfacts.org/api/v2/product";

export async function fetchOFFProduct(barcode) {
  const res = await fetch(`${BASE}/${encodeURIComponent(barcode)}.json`);
  if (!res.ok) throw new Error(`OFF error ${res.status}`);
  const json = await res.json();
  if (json.status !== 1 || !json.product) throw new Error("Product not found");
  return json.product;
}

export function mapOFFToCatalog(product) {
  const name = product.product_name || product.generic_name || product.brands_tags?.[0] || "Food";
  const n100 = product.nutriments || {};
  let kcal = Number(n100["energy-kcal_100g"] ?? NaN);
  if (!Number.isFinite(kcal) && Number.isFinite(n100.energy_100g)) kcal = n100.energy_100g / 4.184;
  const per100g = {
    kcal: round2(kcal || 0),
    protein_g: round2(Number(n100.proteins_100g || 0)),
    carbs_g: round2(Number(n100.carbohydrates_100g || 0)),
    fat_g: round2(Number(n100.fat_100g || 0)),
  };
  return { name, per100g, unit_conversions: {} };
}
function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
