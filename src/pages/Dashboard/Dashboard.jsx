import React from "react";
import NavBar from "../../components/NavBar";
import CalorieSummary from "../../components/calories/CalorieSummary";
import QuickActions from "../../components/QuickActions";
import RecentMealsLogged from "../../components/RecentMealsLogged";
import { getDailyMealLogSummary } from "../../services/mealLogClient";
import { calculateDailyCalorieGoal, getProfile } from "../../services/profileClient";
import "./Dashboard.css";


export default function Dashboard({ user }) {
  const [goal, setGoal] = React.useState(null);
  const [eaten, setEaten] = React.useState(0);
  const avatar = user?.avatar ?? "/cc/avatar.png";

  React.useEffect(() => {
    let active = true;

    async function loadSummary() {
      if (!user?.id) return;

      const [profileResult, summaryResult] = await Promise.allSettled([
        getProfile(user.id),
        getDailyMealLogSummary({ userId: user.id }),
      ]);

      if (!active) return;

      if (profileResult.status === "fulfilled") {
        setGoal(calculateDailyCalorieGoal(profileResult.value));
      } else {
        setGoal(null);
      }

      if (summaryResult.status === "fulfilled") {
        setEaten(Math.round(Number(summaryResult.value?.calories || 0)));
      } else {
        setEaten(0);
      }
    }

    loadSummary();

    const handler = () => loadSummary();
    window.addEventListener("meal-logged", handler);

    return () => {
      active = false;
      window.removeEventListener("meal-logged", handler);
    };
  }, [user?.id]);

  return (
    <div className="app">
    
      <NavBar profileImageSrc={avatar} />

      <main className="container">
        <div className="grid">
          <div>
            <CalorieSummary goal={goal} eaten={eaten} />
            <div >
              <RecentMealsLogged userId={user?.id} />
            </div>
          </div>
          <div>
            <QuickActions />
          </div>
        </div>
      </main>
    </div>
  );
}
