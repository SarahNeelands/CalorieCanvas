import React, { useState } from "react";
import NavBar from "../components/NavBar";
import MealDetails from "../components/calories/MealDetails";
import Ingredients from "../components/calories/Ingredients";
import MealSummary from "../components/calories/MealSummary";
import "./LogMeal.css";

export default function LogMeal({ user }) {
  const avatar = user?.avatar ?? "/cc/avatar.png";

  // lift state so Summary can compute totals live
  const [ingredients, setIngredients] = useState([]);
  const [totalWeight, setTotalWeight] = useState(0);

  return (
    <div className="logmeal-page">
      <NavBar profileImageSrc={avatar} />

      <main className="logmeal-wrap">
        <div className="logmeal-grid">
          <section className="left-col">
            <div className="card card--details">
              <MealDetails onTotalWeightChange={setTotalWeight} />
            </div>

            <div className="card card--ingredients">
              <Ingredients onIngredientsChange={setIngredients} />
            </div>
          </section>

          <aside className="card card--summary">
            <MealSummary ingredients={ingredients} totalWeight={totalWeight} />
          </aside>
        </div>
      </main>
    </div>
  );
}
