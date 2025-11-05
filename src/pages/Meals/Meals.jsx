/**
 * MealsPage.jsx
 * High-level page for the Meals section.
 * Renders two tabs: Meals and Snacks, plus a "New" launcher to create new Meal/Snack.
 */
import React, { useState } from "react";
import MealsList from "../../components/calories/MealsList.jsx";
import SnacksList from "../../components/calories/SnacksList.jsx";
import NewEntryLauncher from "../../components/NewEntryLauncher.jsx";
import NavBar from "../../components/NavBar";

export default function Meals({ user }) {
  const [active, setActive] = useState("meals"); // 'meals' | 'snacks'

  return (
    <main className="meals-page">
      <NavBar profileImageSrc={user.avatar}/>
      <header className="row-between">
        <h1>Meals</h1>
        <NewEntryLauncher />
      </header>

      <div className="tabs">
        <button
          className={active === "meals" ? "tab active" : "tab"}
          onClick={() => setActive("meals")}
        >
          Meals
        </button>
        <button
          className={active === "snacks" ? "tab active" : "tab"}
          onClick={() => setActive("snacks")}
        >
          Snacks
        </button>
      </div>

      <section className="tab-body">
        {active === "meals" ? <MealsList /> : <SnacksList />}
      </section>
    </main>
  );
}
