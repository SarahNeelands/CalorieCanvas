import { render, screen, waitFor } from "@testing-library/react";
import Dashboard from "./Dashboard";
import { getDailyMealLogSummary } from "../../services/mealLogClient";
import { getCachedProfile, getProfile, resolveDailyCalorieGoal } from "../../services/profileClient";

jest.mock("../../components/NavBar", () => () => null);
jest.mock("../../components/QuickActions", () => () => null);
jest.mock("../../components/RecentMealsLogged", () => () => null);
jest.mock("../../components/MyUsuals", () => () => <div>My Usuals request mounted</div>);
jest.mock("../../components/calories/CalorieSummary", () => ({ goal, eaten }) => (
  <div>Calories {eaten} of {goal}</div>
));
jest.mock("../../components/calories/MacrosSummary", () => () => null);
jest.mock("../../components/calories/MicrosSummary", () => () => null);
jest.mock("../../services/authClient", () => ({ getCurrentUserId: jest.fn() }));
jest.mock("../../services/mealLogClient", () => ({ getDailyMealLogSummary: jest.fn() }));
jest.mock("../../services/profileClient", () => ({
  getCachedProfile: jest.fn(),
  getProfile: jest.fn(),
  resolveDailyCalorieGoal: jest.fn((profile) => profile?.calorie_goal ?? null),
}));

test("uses cached dashboard preferences when the profile request fails", async () => {
  getProfile.mockRejectedValue(new Error("Internal server error."));
  getCachedProfile.mockReturnValue({
    calorie_goal: 2100,
    pref_show_calories: true,
    pref_show_macros: false,
    pref_show_micros: false,
    pref_show_usuals: false,
  });
  getDailyMealLogSummary.mockResolvedValue({ calories: 375 });
  resolveDailyCalorieGoal.mockReturnValue(2100);

  render(<Dashboard user={{ id: "user-1" }} />);

  await waitFor(() => expect(screen.getByText("Calories 375 of 2100")).toBeInTheDocument());
  expect(screen.queryByText("My Usuals request mounted")).not.toBeInTheDocument();
});
