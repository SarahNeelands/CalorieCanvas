const UNIT_ALIASES = {
  milligram: "mg",
  milligrams: "mg",
  mg: "mg",
  gram: "g",
  grams: "g",
  g: "g",
  kilogram: "kg",
  kilograms: "kg",
  kg: "kg",
  ounce: "oz",
  ounces: "oz",
  oz: "oz",
  pound: "lb",
  pounds: "lb",
  lb: "lb",
  milliliter: "ml",
  milliliters: "ml",
  ml: "ml",
  cup: "cup",
  cups: "cup",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tbsp: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tsp: "tsp",
  piece: "piece",
  pieces: "piece",
  pc: "piece",
  pcs: "piece",
};

function parseNumber(value) {
  if (!value) return null;
  if (value.includes("/")) {
    const [numerator, denominator] = value.split("/").map(Number);
    return denominator > 0 ? numerator / denominator : null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeUnit(value) {
  return UNIT_ALIASES[String(value || "").trim().toLowerCase()] || "";
}

export function normalizeIngredientName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function splitPreparationNote(value) {
  const [name, ...noteParts] = value.split(",");
  return {
    name: name.trim(),
    note: noteParts.join(",").trim(),
  };
}

export function parseIngredientLine(rawLine, index = 0) {
  const cleaned = String(rawLine || "")
    .trim()
    .replace(/^[-*•]\s*/, "")
    .replace(/\s*\|\s*/g, " ");
  if (!cleaned) return null;

  const leading = cleaned.match(
    /^(\d+(?:\.\d+)?|\d+\/\d+)\s*(mg|milligrams?|g|grams?|kg|kilograms?|oz|ounces?|lb|pounds?|ml|milliliters?|cups?|tbsp|tablespoons?|tsp|teaspoons?|pieces?|pcs?)?\s+(.+)$/i
  );
  const trailing = cleaned.match(
    /^(.+?)[,\s-]+(\d+(?:\.\d+)?|\d+\/\d+)\s*(mg|milligrams?|g|grams?|kg|kilograms?|oz|ounces?|lb|pounds?|ml|milliliters?|cups?|tbsp|tablespoons?|tsp|teaspoons?|pieces?|pcs?)$/i
  );

  let amount = null;
  let unit = "";
  let remainder = cleaned;
  if (leading) {
    amount = parseNumber(leading[1]);
    unit = normalizeUnit(leading[2]);
    remainder = leading[3];
  } else if (trailing) {
    remainder = trailing[1];
    amount = parseNumber(trailing[2]);
    unit = normalizeUnit(trailing[3]);
  }
  if (unit === "kg" && amount !== null) {
    amount *= 1000;
    unit = "g";
  }
  const { name, note } = splitPreparationNote(remainder);
  return {
    id: `parsed-${index}`,
    raw: cleaned,
    name,
    normalizedName: normalizeIngredientName(name),
    note,
    qty: amount === null ? "" : String(amount),
    unit: unit || "g",
  };
}

export function parseIngredientList(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map(parseIngredientLine)
    .filter(Boolean);
}

export function findBestIngredientMatch(parsed, catalog) {
  const target = parsed.normalizedName;
  if (!target) return null;
  const normalized = catalog.map((item) => ({
    item,
    name: normalizeIngredientName(item.title || item.name),
  }));
  const exact = normalized.find((candidate) => candidate.name === target);
  if (exact) return exact.item;
  const contained = normalized.filter(
    (candidate) => candidate.name.includes(target) || target.includes(candidate.name)
  );
  if (contained.length === 1) return contained[0].item;

  const targetWords = new Set(target.split(" ").filter((word) => word.length > 1));
  let best = null;
  let bestScore = 0;
  for (const candidate of normalized) {
    const words = candidate.name.split(" ");
    const overlap = words.filter((word) => targetWords.has(word)).length;
    const score = overlap / Math.max(targetWords.size, words.length, 1);
    if (score > bestScore) {
      best = candidate.item;
      bestScore = score;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

