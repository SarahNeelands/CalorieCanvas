import { parseNutritionText } from "./nutritionLabelOcr";

test("parses pasted nutrition values in any order", () => {
  const parsed = parseNutritionText([
    "Sodium: 310 mg",
    "Total Fat 9 g",
    "Serving Size 30 g",
    "Vitamin C 8 mg",
    "Calories 180",
    "Dietary Fiber 3 g",
    "Protein: 12 g",
    "Total Carbohydrate 14 g",
    "Sugars 4 g",
    "Cholesterol 25 mg",
  ].join("\n"));

  expect(parsed.serving).toEqual(expect.objectContaining({ qty: 30, unit: "g" }));
  expect(parsed.macros).toEqual(expect.objectContaining({
    calories: 180,
    protein: 12,
    carbs: 14,
    fat: 9,
    fiber: 3,
    sugar: 4,
    cholesterol: 25,
  }));
  expect(parsed.micros.sodium).toEqual({ value: 310, unit: "mg" });
  expect(parsed.micros.vitaminC).toEqual({ value: 8, unit: "mg" });
});

test("leaves nutrition values that were not pasted empty", () => {
  const parsed = parseNutritionText("Protein 7 g, Calories 95");

  expect(parsed.macros.protein).toBe(7);
  expect(parsed.macros.calories).toBe(95);
  expect(parsed.macros.carbs == null).toBe(true);
  expect(parsed.micros.sodium == null).toBe(true);
});

test("uses the value following each label when nutrients share a line", () => {
  const parsed = parseNutritionText(
    "Fat 9 g, Sodium 280 mg, Protein 12 g, Carbohydrate 14 g, Calories 190"
  );

  expect(parsed.macros).toEqual(expect.objectContaining({
    calories: 190,
    protein: 12,
    carbs: 14,
    fat: 9,
  }));
  expect(parsed.micros.sodium).toEqual({ value: 280, unit: "mg" });
});
