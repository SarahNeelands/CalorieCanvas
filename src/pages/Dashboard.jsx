import React from "react";
import NavBar from "../components/NavBar";
import CalorieSummary from "../components/CalorieSummary";
import QuickActions from "../components/QuickActions";
import RecentMeals from "../components/RecentMeals";


export default function Dashboard({ user }) {
  const goal = user?.dailyGoal ?? 2000;
  const eaten = user?.today?.kcalEaten ?? 1200;
  const meals = user?.today?.meals ?? [];
  const avatar = user?.avatar ?? "/cc/avatar.png";
  const logo = "/cc/logo-mark.png";

  return (
    <div className="cc-app">
      <img src="/cc/leaves-tl.png" alt="" className="cc-tl" />
      <img src="/cc/leaves-br.png" alt="" className="cc-br" />

      <NavBar logoSrc={logo} profileImageSrc={avatar} />

      <main className="cc-container">
        <div className="cc-grid">
          <div>
            <CalorieSummary goal={goal} eaten={eaten} />
            <div style={{ marginTop: 26 }}>
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
