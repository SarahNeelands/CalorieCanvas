import { render, screen, waitFor } from "@testing-library/react";
import IngredientSearch from "./IngredientSearch";
import { getCachedCatalogItems, listCatalogItems } from "../../services/catalogClient";

jest.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/meals/new" }),
  useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock("../../services/catalogClient", () => ({
  getCachedCatalogItems: jest.fn(() => []),
  listCatalogItems: jest.fn(),
}));

test("lists ingredients and saved meals while excluding the meal being edited", async () => {
  const ingredient = { id: "ingredient-1", title: "Rice", type: "ingredient", unit_conversions: {} };
  const reusableMeal = { id: "meal-1", title: "Bean chili", type: "meal", unit_conversions: {} };
  const currentMeal = { id: "meal-current", title: "Current recipe", type: "meal", unit_conversions: {} };
  getCachedCatalogItems.mockReturnValue([]);
  listCatalogItems.mockImplementation(async (type) => (
    type === "ingredient" ? [ingredient] : [reusableMeal, currentMeal]
  ));

  render(
    <IngredientSearch
      excludedItemId="meal-current"
      onClose={() => {}}
      onSelect={() => {}}
    />
  );

  await waitFor(() => expect(screen.getByText("Rice")).toBeInTheDocument());
  expect(screen.getByText("Bean chili")).toBeInTheDocument();
  expect(screen.queryByText("Current recipe")).not.toBeInTheDocument();
  expect(screen.getByText("Meal")).toBeInTheDocument();
  expect(listCatalogItems).toHaveBeenCalledWith("ingredient");
  expect(listCatalogItems).toHaveBeenCalledWith("meal");
});
