import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Ingredients from "./Ingredients";
import { listCatalogItems } from "../../services/catalogClient";

jest.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/meals/new" }),
  useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock("../../services/catalogClient", () => ({
  listCatalogItems: jest.fn(),
}));

test("rehydrates the paste review after returning from new ingredient creation", async () => {
  const createdIngredient = {
    id: "new-chicken",
    title: "Chicken breast",
    item_type: "ingredient",
    kcal_per_100g: 165,
    protein_g_per_100g: 31,
    carbs_g_per_100g: 0,
    fat_g_per_100g: 3.6,
    unit_conversions: {},
  };
  listCatalogItems.mockResolvedValue([
    createdIngredient,
    { id: "rice", title: "Rice", item_type: "ingredient", unit_conversions: {} },
  ]);
  const onPasteDraftChange = jest.fn();
  const props = {
    ingredients: [],
    onIngredientsChange: jest.fn(),
    mealDraft: { mealName: "Chicken and rice", ingredients: [] },
    onPasteDraftChange,
  };
  const { rerender } = render(
    <Ingredients {...props} pasteDraft={null} />
  );

  rerender(
    <Ingredients
      {...props}
      pasteDraft={{
        showPaste: true,
        pasteText: "Chicken breast, 200 g\nRice, 1 cup",
        createdIngredient,
        createdForRowId: "chicken-row",
        parsedRows: [
          {
            id: "chicken-row",
            raw: "Chicken breast, 200 g",
            name: "Chicken breast",
            normalizedName: "chicken breast",
            qty: "200",
            unit: "g",
            matchedId: "",
            candidateIds: [],
          },
          {
            id: "rice-row",
            raw: "Rice, 1 cup",
            name: "Rice",
            normalizedName: "rice",
            qty: "1",
            unit: "cup",
            matchedId: "rice",
            candidateIds: ["rice"],
          },
        ],
      }}
    />
  );

  expect(screen.getByRole("textbox")).toHaveValue("Chicken breast, 200 g\nRice, 1 cup");
  expect(screen.queryByRole("button", { name: "Chicken breast" })).not.toBeInTheDocument();
  expect(screen.getByText("Rice, 1 cup")).toBeInTheDocument();
  expect(props.onIngredientsChange).toHaveBeenCalledWith([
    expect.objectContaining({ id: "new-chicken", qty: "200", unit: "g" }),
  ]);
  await waitFor(() => expect(listCatalogItems).toHaveBeenCalledWith("ingredient"));
  expect(onPasteDraftChange).toHaveBeenCalledWith(expect.objectContaining({
    createdIngredient: null,
    createdForRowId: null,
    parsedRows: [expect.objectContaining({ id: "rice-row" })],
  }));
});

test("adds a pasted row to the meal as soon as its match is clicked", async () => {
  const rice = {
    id: "rice",
    title: "Rice",
    item_type: "ingredient",
    kcal_per_100g: 130,
    protein_g_per_100g: 2.7,
    carbs_g_per_100g: 28,
    fat_g_per_100g: 0.3,
    unit_conversions: { cup: 185 },
  };
  listCatalogItems.mockResolvedValue([rice]);
  const onIngredientsChange = jest.fn();
  const onPasteDraftChange = jest.fn();

  render(
    <Ingredients
      ingredients={[]}
      onIngredientsChange={onIngredientsChange}
      mealDraft={{ ingredients: [] }}
      pasteDraft={{
        showPaste: true,
        pasteText: "Rice, 1 cup",
        parsedRows: [{
          id: "rice-row",
          raw: "Rice, 1 cup",
          name: "Rice",
          normalizedName: "rice",
          qty: "1",
          unit: "cup",
          matchedId: "",
          candidateIds: ["rice"],
        }],
      }}
      onPasteDraftChange={onPasteDraftChange}
    />
  );

  const matchButton = await screen.findByRole("button", { name: "Rice" });
  fireEvent.click(matchButton);

  expect(onIngredientsChange).toHaveBeenCalledWith([
    expect.objectContaining({ id: "rice", qty: "1", unit: "cup" }),
  ]);
  expect(screen.queryByText("Review matches")).not.toBeInTheDocument();
  expect(onPasteDraftChange).toHaveBeenCalledWith(expect.objectContaining({ parsedRows: [] }));
});
