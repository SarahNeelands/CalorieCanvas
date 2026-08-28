jest.mock("./Meals/LogMealModal.jsx", () => function MockLogMealModal() {
  return null;
});

import { groupMealLogsForRecent } from "./RecentMealsLogged";

function row(overrides) {
  return {
    id: overrides.id,
    meal_id: overrides.meal_id,
    log_date: "2026-08-28",
    logged_at: overrides.logged_at,
    qty: overrides.qty ?? 1,
    unit_code: overrides.unit_code ?? "g",
    grams_resolved: overrides.grams_resolved ?? null,
    kcal: overrides.kcal ?? 0,
    meal: {
      id: overrides.meal_id,
      title: overrides.title,
      type: overrides.type || "meal",
      unit_conversions: overrides.unit_conversions || {},
    },
  };
}

test("groups repeated meals on the same day into one recent meal card model", () => {
  const groups = groupMealLogsForRecent([
    row({ id: "toast-evening", meal_id: "toast", title: "Toast", logged_at: "2026-08-28T23:00:00.000Z", grams_resolved: 50, kcal: 130 }),
    row({ id: "oats", meal_id: "oats", title: "Oats", logged_at: "2026-08-28T12:00:00.000Z", grams_resolved: 80, kcal: 310 }),
    row({ id: "toast-morning", meal_id: "toast", title: "Toast", logged_at: "2026-08-28T11:00:00.000Z", grams_resolved: 40, kcal: 110 }),
  ]);

  expect(groups).toHaveLength(2);
  expect(groups[0]).toEqual(expect.objectContaining({
    title: "Toast",
    totalKcal: 240,
  }));
  expect(groups[0].entries.map((entry) => entry.id)).toEqual(["toast-evening", "toast-morning"]);
  expect(groups[1].title).toBe("Oats");
});

test("keeps the same meal separate across different log dates", () => {
  const groups = groupMealLogsForRecent([
    row({ id: "today", meal_id: "toast", title: "Toast", logged_at: "2026-08-28T11:00:00.000Z" }),
    {
      ...row({ id: "yesterday", meal_id: "toast", title: "Toast", logged_at: "2026-08-27T11:00:00.000Z" }),
      log_date: "2026-08-27",
    },
  ]);

  expect(groups).toHaveLength(2);
});
