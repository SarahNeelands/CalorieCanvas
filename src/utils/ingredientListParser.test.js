import {
  findBestIngredientMatch,
  parseIngredientList,
} from "./ingredientListParser";

test("parses common pasted ingredient formats", () => {
  expect(parseIngredientList([
    "600g chicken breast",
    "300 g dry rice",
    "1 tbsp olive oil",
    "bell pepper, 2 pieces",
    "1/2 cup soy sauce, low sodium",
  ].join("\n"))).toEqual([
    expect.objectContaining({ name: "chicken breast", qty: "600", unit: "g" }),
    expect.objectContaining({ name: "dry rice", qty: "300", unit: "g" }),
    expect.objectContaining({ name: "olive oil", qty: "1", unit: "tbsp" }),
    expect.objectContaining({ name: "bell pepper", qty: "2", unit: "piece" }),
    expect.objectContaining({ name: "soy sauce", qty: "0.5", unit: "cup", note: "low sodium" }),
  ]);
});

test("matches normalized catalog names without silently choosing weak matches", () => {
  const catalog = [
    { id: "chicken", title: "Chicken Breast" },
    { id: "rice", title: "White Rice, Dry" },
  ];
  expect(findBestIngredientMatch(
    parseIngredientList("600 g chicken breast")[0],
    catalog
  )).toEqual(catalog[0]);
  expect(findBestIngredientMatch(
    parseIngredientList("1 tbsp mystery sauce")[0],
    catalog
  )).toBeNull();
});

