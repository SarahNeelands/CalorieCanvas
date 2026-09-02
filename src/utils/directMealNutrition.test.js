import {
  buildDirectMealCatalogPayload,
  parsedMealNutritionPatch,
} from "./directMealNutrition";
import { parseNutritionText } from "./nutritionLabelOcr";

test("builds a meal catalog item from pasted whole-meal nutrition", () => {
  const patch = parsedMealNutritionPatch(parseNutritionText([
    "Serving size: 650 g",
    "Calories 820",
    "Protein 48 g, Carbs 92 g, Fat 28 g",
    "Fiber 10 g, Sodium 980 mg",
  ].join("\n")));

  expect(patch).toEqual(expect.objectContaining({
    totalWeight: "650",
    recognizedCount: 7,
  }));
  expect(patch.macros).toEqual(expect.objectContaining({
    calories: "820",
    protein: "48",
    carbs: "92",
    fat: "28",
    fiber: "10",
  }));
  expect(patch.micros.sodium).toEqual({ value: "980", unit: "mg" });

  const payload = buildDirectMealCatalogPayload({
    mealName: "Rice bowl",
    timestamp: "2026-09-02T12:30",
    totalWeight: patch.totalWeight,
    servingCount: "2",
    macros: patch.macros,
    micros: patch.micros,
  });

  expect(payload).toEqual(expect.objectContaining({
    title: "Rice bowl",
    item_type: "meal",
    kcal_per_100g: 126.15,
    protein_g_per_100g: 7.38,
    carbs_g_per_100g: 14.15,
    fat_g_per_100g: 4.31,
  }));
  expect(payload.unit_conversions).toEqual(expect.objectContaining({
    direct_nutrition: true,
    quantity: 325,
    quantity_label: "serving",
    total_weight_g: 650,
    servings_count: 2,
    ingredients: [],
  }));
  expect(payload.unit_conversions.macros_per_100g.fiber).toBe(1.54);
  expect(payload.unit_conversions.micros_per_100g.sodium).toBe(150.77);
});

test("requires calories and a nutrition weight for direct meal nutrition", () => {
  expect(() => buildDirectMealCatalogPayload({
    mealName: "Incomplete meal",
    totalWeight: "",
    servingCount: "",
    macros: { calories: "200" },
    micros: {},
  })).toThrow("Enter the weight");

  expect(() => buildDirectMealCatalogPayload({
    mealName: "Incomplete meal",
    totalWeight: "300",
    servingCount: "",
    macros: {},
    micros: {},
  })).toThrow("Enter calories");
});
