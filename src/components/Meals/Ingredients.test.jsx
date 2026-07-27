import { render, screen, waitFor } from "@testing-library/react";
import Ingredients from "./Ingredients";
import { listCatalogItems } from "../../services/catalogClient";

jest.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/meals/new" }),
  useNavigate: () => jest.fn(),
}));

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
  expect(screen.getByRole("button", { name: "Chicken breast" })).toHaveClass("is-selected");
  expect(screen.getByText("Rice, 1 cup")).toBeInTheDocument();
  await waitFor(() => expect(listCatalogItems).toHaveBeenCalledWith("ingredient"));
  expect(onPasteDraftChange).toHaveBeenCalledWith(expect.objectContaining({
    createdIngredient: null,
    createdForRowId: null,
    parsedRows: expect.arrayContaining([
      expect.objectContaining({ id: "chicken-row", matchedId: "new-chicken" }),
    ]),
  }));
});
