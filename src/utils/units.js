export function unitOptionsForFood(item) {
  const opts = ["g"];
  const conv = item?.unit_conversions || null;
  if (!conv) return opts;
  if (conv.ml) opts.push("ml");
  if (conv.cup) opts.push("cup");
  if (conv.quantity) opts.push("quantity");
  return opts;
}

export function resolveToGrams({ unit, qty, item }) {
  const conv = item?.unit_conversions || {};
  if (unit === "g") return Number(qty) || 0;
  const gramsPerUnit = conv[unit];
  if (!gramsPerUnit) {
    if (unit === "ml") return Number(qty) || 0;
    return 0;
  }
  return (Number(qty) || 0) * Number(gramsPerUnit);
}
