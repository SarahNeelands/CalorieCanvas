import { recognize } from "tesseract.js";

function loadImage(imageSource) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image for OCR."));
    image.src = imageSource;
  });
}

async function upscaleImageForOcr(imageSource) {
  if (typeof document === "undefined") {
    return { color: imageSource, highContrast: imageSource };
  }

  const image = await loadImage(imageSource);
  const longestSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const scale = longestSide > 0 ? Math.max(1.4, 2400 / longestSide) : 1.4;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    return imageSource;
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const colorDataUrl = canvas.toDataURL("image/png");
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
    const boosted = luminance > 172 ? 255 : luminance < 132 ? 0 : 255;
    data[index] = boosted;
    data[index + 1] = boosted;
    data[index + 2] = boosted;
  }

  context.putImageData(imageData, 0, 0);

  return {
    color: colorDataUrl,
    highContrast: canvas.toDataURL("image/png"),
  };
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function flattenText(text) {
  return normalizeText(text).replace(/\n+/g, " ");
}

function textLines(text) {
  return normalizeText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeLineForMatching(line) {
  return String(line || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match;
  }
  return null;
}

function toNumber(value) {
  const numeric = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function singularize(label) {
  const cleaned = String(label || "").trim().toLowerCase();
  if (!cleaned) return "";
  if (cleaned.endsWith("ies")) return `${cleaned.slice(0, -3)}y`;
  if (cleaned.endsWith("s")) return cleaned.slice(0, -1);
  return cleaned;
}

function extractServing(text) {
  const lines = textLines(text);
  const lineText = lines.join("\n");
  const flatText = flattenText(text);

  const packageServing = firstMatch(lineText, [
    /per\s+(\d+(?:\.\d+)?)\s+([a-z]+)\s*\((\d+(?:\.\d+)?)\s*(g|mg|ml|oz|lb)\)/i,
    /pour\s+(\d+(?:\.\d+)?)\s+([a-z]+)\s*\((\d+(?:\.\d+)?)\s*(g|mg|ml|oz|lb)\)/i,
    /serving\s*size[^\n]*?(\d+(?:\.\d+)?)\s+([a-z]+)\s*\((\d+(?:\.\d+)?)\s*(g|mg|ml|oz|lb)\)/i,
    /serving\s*size[^\n]*?(\d+(?:\.\d+)?)\s*([a-z]+)[^\n]*?(\d+(?:\.\d+)?)\s*(g|mg|ml|oz|lb)/i,
    /about\s+(\d+(?:\.\d+)?)\s+([a-z]+)\s*\((\d+(?:\.\d+)?)\s*(g|mg|ml|oz|lb)\)/i,
    /(\d+(?:\.\d+)?)\s+([a-z]+)\s*\((\d+(?:\.\d+)?)\s*(g|mg|ml|oz|lb)\)/i,
  ]) || firstMatch(flatText, [
    /per\s+(\d+(?:\.\d+)?)\s+([a-z]+)\s*\((\d+(?:\.\d+)?)\s*(g|mg|ml|oz|lb)\)/i,
    /pour\s+(\d+(?:\.\d+)?)\s+([a-z]+)\s*\((\d+(?:\.\d+)?)\s*(g|mg|ml|oz|lb)\)/i,
    /serving\s*size[^a-z0-9]{0,8}(\d+(?:\.\d+)?)\s+([a-z]+)\s*\((\d+(?:\.\d+)?)\s*(g|mg|ml|oz|lb)\)/i,
    /serving\s*size[^a-z0-9]{0,8}(\d+(?:\.\d+)?)\s*([a-z]+)[^a-z0-9]{0,8}(\d+(?:\.\d+)?)\s*(g|mg|ml|oz|lb)/i,
    /(\d+(?:\.\d+)?)\s+([a-z]+)\s*\((\d+(?:\.\d+)?)\s*(g|mg|ml|oz|lb)\)/i,
  ]);

  const servingWeight = firstMatch(lineText, [
    /serving\s*size[^\n]*?(\d+(?:\.\d+)?)\s*(g|mg|ml|oz|lb|cup|tbsp|tsp|piece)/i,
  ]) || firstMatch(flatText, [
    /serving\s*size[^0-9]{0,12}(\d+(?:\.\d+)?)\s*(g|mg|ml|oz|lb|cup|tbsp|tsp|piece)/i,
  ]);

  if (packageServing) {
    return {
      count: toNumber(packageServing[1]),
      countLabel: singularize(packageServing[2]),
      qty: toNumber(packageServing[3]),
      unit: packageServing[4].toLowerCase(),
    };
  }

  if (servingWeight) {
    return {
      count: null,
      countLabel: "",
      qty: toNumber(servingWeight[1]),
      unit: servingWeight[2].toLowerCase(),
    };
  }

  return null;
}

function extractCalories(text) {
  const match = firstMatch(text, [
    /calories[^\d\n]{0,12}(\d+(?:\.\d+)?)/i,
    /calories[^0-9]{0,8}(\d+(?:\.\d+)?)/i,
  ]);
  return match ? toNumber(match[1]) : null;
}

function extractNutrient(text, labels, defaultUnit, preferredKind = "amount") {
  const labelPattern = labels.join("|");
  const lines = textLines(text);

  const amountPattern = new RegExp(`(?:${labelPattern})[^\\d%\\n]{0,20}(\\d+(?:\\.\\d+)?)\\s*(mg|g|mcg|kcal|cal)`, "i");
  const percentPattern = new RegExp(`(?:${labelPattern})[^\\d%\\n]{0,20}(\\d+(?:\\.\\d+)?)\\s*(%)`, "i");
  const flexiblePattern = new RegExp(`(?:${labelPattern})[^\\d%\\n]{0,20}(\\d+(?:\\.\\d+)?)\\s*(mg|g|mcg|kcal|cal|%)?`, "i");

  const lineMatch = (() => {
    for (const line of lines) {
      if (preferredKind === "percent") {
        const pct = line.match(percentPattern);
        if (pct) return pct;
      }
      const amt = line.match(amountPattern);
      if (amt) return amt;
      const pct = line.match(percentPattern);
      if (pct) return pct;
      const flex = line.match(flexiblePattern);
      if (flex) return flex;
    }
    return null;
  })();

  const match = lineMatch || firstMatch(flattenText(text), [
    amountPattern,
    percentPattern,
    flexiblePattern,
  ]);

  if (!match) return null;

  const value = toNumber(match[1]);
  if (value === null) return null;

  let unit = (match[2] || defaultUnit || "").toLowerCase();
  if (unit === "%") unit = "percent_dv";
  if (!unit) unit = defaultUnit;

  return { value, unit };
}

function extractSpecificNutrientValue(text, labels, options = {}) {
  const { unit = "mg", preferredKind = "amount" } = options;
  const lines = textLines(text);
  const normalizedLabels = labels.map((label) =>
    normalizeLineForMatching(label.replace(/\\s\*/g, " ").replace(/\\/g, ""))
  );

  for (const rawLine of lines) {
    const line = normalizeLineForMatching(rawLine);
    const labelFound = normalizedLabels.some((label) => line.includes(label));
    if (!labelFound) continue;

    const amountMatch = line.match(/(\d+(?:\.\d+)?)\s*(mg|g|mcg|%)?/i);
    if (!amountMatch) continue;

    const value = toNumber(amountMatch[1]);
    if (value === null) continue;

    let parsedUnit = (amountMatch[2] || unit || "").toLowerCase();
    if (parsedUnit === "%") parsedUnit = "percent_dv";
    if (!parsedUnit) parsedUnit = unit;

    if (preferredKind === "percent" && parsedUnit !== "percent_dv") {
      const percentMatch = line.match(/(\d+(?:\.\d+)?)\s*%/);
      if (percentMatch) {
        return { value: toNumber(percentMatch[1]), unit: "percent_dv" };
      }
    }

    return { value, unit: parsedUnit };
  }

  return extractNutrient(text, labels, unit, preferredKind);
}

function extractFiberValue(text) {
  const lines = textLines(text);

  for (const rawLine of lines) {
    const line = normalizeLineForMatching(rawLine);
    if (!/(^|\s)(fiber|fibre|fibres)(\s|$)/i.test(line)) continue;
    if (/(saturated|fat|lipides|carbohydrate|glucides)/i.test(line)) continue;

    const amountMatch = line.match(/(?:fiber|fibre|fibres)[^\d]{0,12}(\d+(?:\.\d+)?)\s*g/i);
    if (!amountMatch) continue;

    const value = toNumber(amountMatch[1]);
    if (value !== null) {
      return value;
    }
  }

  return extractSpecificNutrientValue(text, ["dietary fiber", "dietaryfiber", "fiber", "fibre", "fibres"], { unit: "g" })?.value ?? null;
}

function extractFromPatterns(text, patterns, unit = "mg") {
  const normalized = normalizeText(text);
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const value = toNumber(match[1]);
    if (value === null) continue;
    return { value, unit };
  }
  return null;
}

function parseNutritionText(rawText) {
  const text = normalizeText(rawText);
  const flatText = flattenText(rawText);
  const serving = extractServing(text);
  const calories = extractCalories(flatText);

  return {
    serving,
    macros: {
      calories,
      protein: extractSpecificNutrientValue(text, ["protein", "proteines"], { unit: "g" })?.value,
      carbs: extractSpecificNutrientValue(text, ["total carbohydrate", "carbohydrate", "glucides", "carbs"], { unit: "g" })?.value,
      fat: extractSpecificNutrientValue(text, ["total fat", "fat", "lipides"], { unit: "g" })?.value,
      fiber: extractFiberValue(text),
      sugar: extractSpecificNutrientValue(text, ["includes added sugars", "total sugars", "sugars", "sugar", "sucres"], { unit: "g" })?.value,
      cholesterol: (
        extractSpecificNutrientValue(text, ["cholesterol", "cholestrol", "cholestero", "cholesterol cholestérol"], { unit: "mg" }) ||
        extractFromPatterns(text, [
          /cholesterol[^\d]{0,16}(\d+(?:\.\d+)?)\s*mg/i,
          /cholestrol[^\d]{0,16}(\d+(?:\.\d+)?)\s*mg/i,
          /cholestero[^\d]{0,16}(\d+(?:\.\d+)?)\s*mg/i,
          /cholesterol\s*\/\s*cholesterol[^\d]{0,16}(\d+(?:\.\d+)?)\s*mg/i,
        ], "mg")
      )?.value,
    },
    micros: {
      sodium:
        extractSpecificNutrientValue(text, ["sodium", "sodiurn", "sodlum"], { unit: "mg" }) ||
        extractFromPatterns(text, [
          /sodium[^\d]{0,12}(\d+(?:\.\d+)?)\s*mg/i,
          /sodiurn[^\d]{0,12}(\d+(?:\.\d+)?)\s*mg/i,
          /sodlum[^\d]{0,12}(\d+(?:\.\d+)?)\s*mg/i,
        ], "mg"),
      potassium:
        extractSpecificNutrientValue(text, ["potassium", "potassiurn", "potasslum"], { unit: "mg" }) ||
        extractFromPatterns(text, [
          /potassium[^\d]{0,12}(\d+(?:\.\d+)?)\s*mg/i,
          /potassiurn[^\d]{0,12}(\d+(?:\.\d+)?)\s*mg/i,
          /potasslum[^\d]{0,12}(\d+(?:\.\d+)?)\s*mg/i,
        ], "mg"),
      calcium:
        extractSpecificNutrientValue(text, ["calcium", "caicium", "calcıum", "calclum"], { unit: "mg" }) ||
        extractFromPatterns(text, [
          /calcium[^\d]{0,12}(\d+(?:\.\d+)?)\s*mg/i,
          /caicium[^\d]{0,12}(\d+(?:\.\d+)?)\s*mg/i,
          /calclum[^\d]{0,12}(\d+(?:\.\d+)?)\s*mg/i,
        ], "mg"),
      iron: extractSpecificNutrientValue(text, ["iron", "fer"], { unit: "mg" }),
      vitaminA: extractNutrient(text, ["vitamin\\s*a"], "percent_dv", "percent"),
      vitaminC: extractSpecificNutrientValue(text, ["vitamin c"], { unit: "mg" }),
    },
    rawText: text,
  };
}

export async function scanNutritionLabelFromImage(imageSource) {
  const preparedImage = await upscaleImageForOcr(imageSource);
  const [colorResult, contrastResult] = await Promise.all([
    recognize(preparedImage.color, "eng"),
    recognize(preparedImage.highContrast, "eng"),
  ]);

  const mergedText = [colorResult?.data?.text, contrastResult?.data?.text]
    .filter(Boolean)
    .join("\n");

  return parseNutritionText(mergedText);
}
