import {
  availableCatalogUnits,
  calculateCatalogMacro,
  calculateCatalogMicro,
  catalogUsageWeightGrams,
  getDefaultCatalogUsage,
} from "./catalogItemUsage";

const meal = {
  type: "meal",
  kcal_per_100g: 150,
  protein_g_per_100g: 10,
  carbs_g_per_100g: 20,
  fat_g_per_100g: 5,
  unit_conversions: {
    quantity: 250,
    serving_size: { qty: 250, unit: "serving" },
    macros_per_100g: { fiber: 4 },
    micros_per_100g: { sodium: 300 },
  },
};

test("uses a saved meal by serving when composing another meal", () => {
  expect(getDefaultCatalogUsage(meal)).toEqual({ qty: "", unit: "serving" });
  expect(availableCatalogUnits(meal)).toContain("serving");
  expect(catalogUsageWeightGrams(meal, 2, "serving")).toBe(500);
  expect(calculateCatalogMacro(meal, 2, "serving", "calories")).toBe(750);
  expect(calculateCatalogMacro(meal, 2, "serving", "protein")).toBe(50);
  expect(calculateCatalogMacro(meal, 2, "serving", "fiber")).toBe(20);
  expect(calculateCatalogMicro(meal, 2, "serving", "sodium")).toBe(1500);
});

test("also supports using a saved meal by weight", () => {
  expect(calculateCatalogMacro(meal, 50, "g", "calories")).toBe(75);
  expect(calculateCatalogMicro(meal, 50, "g", "sodium")).toBe(150);
});
