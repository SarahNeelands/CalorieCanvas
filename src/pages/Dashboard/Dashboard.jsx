import React from "react";
import NavBar from "../../components/NavBar";
import CalorieSummary from "../../components/calories/CalorieSummary";
import MacrosSummary from "../../components/calories/MacrosSummary";
import MicrosSummary from "../../components/calories/MicrosSummary";
import QuickActions from "../../components/QuickActions";
import RecentMealsLogged from "../../components/RecentMealsLogged";
import { macroTargetsByProfile, microTargetsByProfile } from "../../components/calories/nutrientTargets";
import { getCurrentUserId } from "../../services/authClient";
import { getDailyMealLogSummary } from "../../services/mealLogClient";
import { calculateDailyCalorieGoal, getProfile } from "../../services/profileClient";
import "./Dashboard.css";


export default function Dashboard({ user }) {
  const [resolvedUserId, setResolvedUserId] = React.useState(user?.id || null);
  const [goal, setGoal] = React.useState(null);
  const [profile, setProfile] = React.useState(null);
  const [showCalories, setShowCalories] = React.useState(true);
  const [showMacros, setShowMacros] = React.useState(true);
  const [showMicros, setShowMicros] = React.useState(false);
  const [eaten, setEaten] = React.useState(0);
  const [macros, setMacros] = React.useState({
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
    sugar_g: 0,
    cholesterol_mg: 0,
  });
  const [micros, setMicros] = React.useState({
    sodium_mg: 0,
    potassium_mg: 0,
    calcium_mg: 0,
    iron_mg: 0,
    vitamin_a_mcg: 0,
    vitamin_c_mg: 0,
  });
  const avatar = user?.avatar ?? "/cc/avatar.png";

  React.useEffect(() => {
    let active = true;

    async function loadSummary() {
      const userId = user?.id || await getCurrentUserId();
      if (!active) return;
      if (!userId) {
        return;
      }
      setResolvedUserId(userId);

      const [profileResult, summaryResult] = await Promise.allSettled([
        getProfile(userId),
        getDailyMealLogSummary({ userId }),
      ]);

      if (!active) return;

      if (profileResult.status === "fulfilled") {
        const profile = profileResult.value;
        setProfile(profile || null);
        setGoal(Number(profile?.calorie_goal) > 0 ? Number(profile.calorie_goal) : calculateDailyCalorieGoal(profile));
        setShowCalories(profile?.pref_show_calories !== false);
        setShowMacros(profile?.pref_show_macros !== false);
        setShowMicros(Boolean(profile?.pref_show_micros));
      } else {
        setProfile(null);
        setGoal(null);
        setShowCalories(true);
        setShowMacros(true);
        setShowMicros(false);
      }

      if (summaryResult.status === "fulfilled") {
        const summary = summaryResult.value || {};
        setEaten(Math.round(Number(summary.calories || 0)));
        setMacros({
          protein_g: Number(summary.protein_g || 0),
          carbs_g: Number(summary.carbs_g || 0),
          fat_g: Number(summary.fat_g || 0),
          fiber_g: Number(summary.fiber_g || 0),
          sugar_g: Number(summary.sugar_g || 0),
          cholesterol_mg: Number(summary.cholesterol_mg || 0),
        });
        setMicros({
          sodium_mg: Number(summary.sodium_mg || 0),
          potassium_mg: Number(summary.potassium_mg || 0),
          calcium_mg: Number(summary.calcium_mg || 0),
          iron_mg: Number(summary.iron_mg || 0),
          vitamin_a_mcg: Number(summary.vitamin_a_mcg || 0),
          vitamin_c_mg: Number(summary.vitamin_c_mg || 0),
        });
      } else {
        setEaten(0);
        setMacros({
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          fiber_g: 0,
          sugar_g: 0,
          cholesterol_mg: 0,
        });
        setMicros({
          sodium_mg: 0,
          potassium_mg: 0,
          calcium_mg: 0,
          iron_mg: 0,
          vitamin_a_mcg: 0,
          vitamin_c_mg: 0,
        });
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
            {showCalories && <CalorieSummary goal={goal} eaten={eaten} />}
            {showMacros && (
              <div className="dashboard-macros">
                <h3 className="dashboard-section-title">Macros</h3>
                <MacrosSummary
                  macros={macros}
                  targets={macroTargetsByProfile(profile, goal)}
                />
              </div>
            )}
            {showMicros && (
              <div className="dashboard-macros">
                <h3 className="dashboard-section-title">Micronutrients</h3>
                <MicrosSummary
                  micros={micros}
                  targets={microTargetsByProfile(profile)}
                />
              </div>
            )}
            <div >
              <RecentMealsLogged userId={resolvedUserId} />
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
