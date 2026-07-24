import { buildMealLogPayload, getFoodUnitLabel } from "./mealLogPayload";

const chocolate = {
  id: "chocolate",
  title: "Chocolate",
  type: "snack",
  kcal_per_100g: 500,
  protein_g_per_100g: 5,
  carbs_g_per_100g: 50,
  fat_g_per_100g: 30,
  unit_conversions: {
    quantity: 8,
    quantity_label: "square",
    macros_per_100g: { fiber: 10 },
  },
};

test("builds a complete one-tap snack payload from a custom quantity", () => {
  const payload = buildMealLogPayload({
    item: chocolate,
    qty: 2,
    unit: "quantity",
    loggedAt: "2026-07-23T12:00:00.000Z",
  });
  expect(payload).toEqual(expect.objectContaining({
    meal_id: "chocolate",
    qty: 2,
    unit_code: "quantity",
    grams_resolved: 16,
    kcal: 80,
    protein_g: 0.8,
    fiber_g: 1.6,
    meal_type: "snack",
    logged_at: "2026-07-23T12:00:00.000Z",
  }));
  expect(getFoodUnitLabel(chocolate, "quantity")).toBe("square");
});

