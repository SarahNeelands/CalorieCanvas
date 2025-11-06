import React, { useState } from "react";
import NavBar from "../../components/NavBar";
import MealDetails from "../../components/Meals/MealDetails";
import Ingredients from "../../components/Meals/Ingredients";
import MealSummary from "../../components/Meals/MealSummary";
import "./LogMeal.css";

/**
 * LogMeal layout:
 * Left side: two equal halves that shrink when space is limited (no internal scroll)
 * Right side: summary (sticky on desktop)
 */
export default function LogMeal({ user }) {
  const avatar = user?.avatar ?? "/cc/avatar.png";

  const [ingredients, setIngredients] = useState([]);
  const [totalWeight, setTotalWeight] = useState(0);

  return (
    <div className="logmeal-page">
      <NavBar profileImageSrc={avatar} />

      <main className="logmeal-wrap">
        <div className="logmeal-grid">
          {/* LEFT COLUMN */}
          <section className="left-col">
            {/* Top half */}
            <div className="card card--details">
              <MealDetails onTotalWeightChange={setTotalWeight} />
            </div>

            {/* Bottom half */}
            <div className="card card--ingredients">
              <Ingredients onIngredientsChange={setIngredients} />
            </div>
          </section>

          {/* RIGHT COLUMN */}
          <aside className="card card--summary" style={{ minWidth: 0 }}>
            <MealSummary ingredients={ingredients} totalWeight={totalWeight} />
          </aside>
        </div>
      </main>
    </div>
  );
}
