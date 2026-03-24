/**
 * MealsPage.jsx
 * High-level page for the Meals section.
 * Shows split meal/snack columns on desktop and a tabbed view on phones.
 */
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LogMealModal from "../../components/Meals/LogMealModal.jsx";
import MealsList from "../../components/Meals/MealsList.jsx";
import SnacksList from "../../components/Meals/SnacksList.jsx";
import NavBar from "../../components/NavBar";
import "./Meals.css";

export default function Meals({ user }) {
  const [active, setActive] = useState("meals");
  const [logOpen, setLogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const onSelectToLog = (item) => {
    setSelectedItem(item);
    setLogOpen(true);
  };

  const location = useLocation();
  const navigate = useNavigate();

  const onEditMeal = (item) => {
    navigate("/meals/new", {
      state: {
        editMeal: item,
      },
    });
  };

  useEffect(() => {
    if (location?.state?.openLogMeal) {
      setLogOpen(true);
      try {
        navigate(location.pathname, { replace: true, state: {} });
      } catch (e) {}
    }
  }, [location, navigate]);

  const mealAddButton = (
    <button
      type="button"
      className="meals-add-button"
      onClick={() => navigate("/meals/new")}
    >
      Add Meal
    </button>
  );

  const snackAddButton = (
    <button
      type="button"
      className="meals-add-button"
      onClick={() => navigate("/snacks/new")}
    >
      Add Snack
    </button>
  );

  return (
    <main className="meals-page">
      <NavBar profileImageSrc={user.avatar} />
      <div className="meals-shell">
        <header className="meals-header">
          <div>
            <h1 className="meals-title">Meals</h1>
            <p className="meals-subtitle">Browse, edit, and log your saved meals and snacks.</p>
          </div>
        </header>

        <div className="meals-tabs">
          <button
            className={active === "meals" ? "meals-tab active" : "meals-tab"}
            onClick={() => setActive("meals")}
          >
            Meals
          </button>
          <button
            className={active === "snacks" ? "meals-tab active" : "meals-tab"}
            onClick={() => setActive("snacks")}
          >
            Snacks
          </button>
        </div>

        <section className="meals-panel meals-panel--mobile">
          {active === "meals" ? (
            <MealsList
              userId={user?.id}
              onLogClick={onSelectToLog}
              onEditClick={onEditMeal}
              title="Meals"
              headerAction={mealAddButton}
            />
          ) : (
            <SnacksList
              userId={user?.id}
              onLogClick={onSelectToLog}
              title="Snacks"
              headerAction={snackAddButton}
            />
          )}
        </section>

        <section className="meals-desktop-grid">
          <div className="meals-panel meals-panel--desktop">
            <MealsList
              userId={user?.id}
              onLogClick={onSelectToLog}
              onEditClick={onEditMeal}
              title="Meals"
              headerAction={mealAddButton}
            />
          </div>
          <div className="meals-panel meals-panel--desktop">
            <SnacksList
              userId={user?.id}
              onLogClick={onSelectToLog}
              title="Snacks"
              headerAction={snackAddButton}
            />
          </div>
        </section>
      </div>
      <LogMealModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        userId={user?.id}
        item={selectedItem}
      />
    </main>
  );
}
