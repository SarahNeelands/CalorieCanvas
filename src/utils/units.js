export function unitOptionsForFood(item) {
  const opts = ["g"];
  const conv = item?.unit_conversions || null;
  if (!conv) return opts;
  for (const unit of ["mg", "oz", "lb", "ml", "cup", "tbsp", "tsp", "piece"]) {
    if (Number(conv[unit]) > 0 && !opts.includes(unit)) {
      opts.push(unit);
    }
  }
  if (conv.quantity) opts.push("quantity");
  return opts;
}

export function resolveToGrams({ unit, qty, item }) {
  const conv = item?.unit_conversions || {};
  if (unit === "g") return Number(qty) || 0;
  if (unit === "mg") return (Number(qty) || 0) * 0.001;
  if (unit === "oz") return (Number(qty) || 0) * 28.3495;
  if (unit === "lb") return (Number(qty) || 0) * 453.592;
  const gramsPerUnit = conv[unit];
  if (!gramsPerUnit) {
    if (unit === "ml") return Number(qty) || 0;
    return 0;
  }
  return (Number(qty) || 0) * Number(gramsPerUnit);
}
