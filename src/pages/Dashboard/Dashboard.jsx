import React from "react";
import NavBar from "../../components/NavBar";
import CalorieSummary from "../../components/calories/CalorieSummary";
import QuickActions from "../../components/QuickActions";
import RecentMeals from "../../components/calories/RecentMeals";
import "./Dashboard.css";


export default function Dashboard({ user }) {
  const goal = user?.dailyGoal ?? 2000;
  const eaten = user?.today?.kcalEaten ?? 1200;
  const meals = user?.today?.meals ?? [];
  const avatar = user?.avatar ?? "/cc/avatar.png";
  const logo = "/cc/logo-mark.png";

  return (
    <div className="app">
    
      <NavBar profileImageSrc={avatar} />

      <main className="container">
        <div className="grid">
          <div>
            <CalorieSummary goal={goal} eaten={eaten} />
            <div >
              <RecentMeals meals={meals} />
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
