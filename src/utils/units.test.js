import { resolveToGrams, unitOptionsForFood } from "./units";

describe("food unit conversions", () => {
  const item = {
    unit_conversions: {
      cup: 240,
      tsp: 5,
      piece: 50,
    },
  };

  test("resolves fractional saved measures to grams", () => {
    expect(resolveToGrams({ unit: "cup", qty: 0.25, item })).toBe(60);
    expect(resolveToGrams({ unit: "tsp", qty: 0.5, item })).toBe(2.5);
    expect(resolveToGrams({ unit: "piece", qty: 1.5, item })).toBe(75);
  });

  test("only exposes saved custom measures alongside mass units", () => {
    expect(unitOptionsForFood(item)).toEqual(["g", "cup", "tsp", "piece"]);
  });
});
