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
import Modal from "../../components/ui/Modal.jsx";
import { createGuestimateMealLog } from "../../services/mealLogClient";
import "./Meals.css";

function toDatetimeLocal(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export default function Meals({ user }) {
  const [active, setActive] = useState("meals");
  const [logOpen, setLogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [guestimateOpen, setGuestimateOpen] = useState(false);
  const [guestimateCalories, setGuestimateCalories] = useState("");
  const [guestimateAt, setGuestimateAt] = useState(toDatetimeLocal());
  const [guestimateSaving, setGuestimateSaving] = useState(false);
  const [guestimateError, setGuestimateError] = useState("");
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

  const onEditSnack = (item) => {
    navigate("/snacks/new", {
      state: {
        snack: item,
      },
    });
  };

  useEffect(() => {
    if (location?.state?.openLogMeal) {
      setSelectedItem(location.state.selectedLogItem || null);
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

  const openGuestimate = () => {
    setGuestimateCalories("");
    setGuestimateAt(toDatetimeLocal());
    setGuestimateError("");
    setGuestimateOpen(true);
  };

  const saveGuestimate = async (event) => {
    event.preventDefault();
    const calories = Number(guestimateCalories);
    if (!(calories > 0)) {
      setGuestimateError("Enter estimated calories greater than 0.");
      return;
    }
    try {
      setGuestimateSaving(true);
      setGuestimateError("");
      const loggedAt = new Date(guestimateAt).toISOString();
      const date = guestimateAt.slice(0, 10);
      const saved = await createGuestimateMealLog({
        userId: user?.id,
        calories: Math.round(calories),
        date,
        loggedAt,
      });
      window.dispatchEvent(new CustomEvent("meal-logged", { detail: { payload: saved } }));
      setGuestimateOpen(false);
      navigate("/", { replace: false });
    } catch (error) {
      setGuestimateError(error.message || "Failed to save guestimate meal.");
    } finally {
      setGuestimateSaving(false);
    }
  };

  return (
    <main className="meals-page">
      <NavBar profileImageSrc={user.avatar} />
      <div className="meals-shell">
        <header className="meals-header cc-page-heading">
          <div>
            <h1 className="meals-title cc-page-title">Meals</h1>
            <p className="meals-subtitle cc-page-subtitle">Browse, edit, and log your saved meals and snacks.</p>
          </div>
          <button type="button" className="meals-guestimate-button" onClick={openGuestimate}>
            Guestimate Meal
          </button>
        </header>

        <div className="meals-tabs" data-active={active}>
          <span className="meals-tabs__indicator" aria-hidden="true" />
          <button
            className={active === "meals" ? "meals-tab active" : "meals-tab"}
            onClick={() => setActive("meals")}
            type="button"
          >
            Meals
          </button>
          <button
            className={active === "snacks" ? "meals-tab active" : "meals-tab"}
            onClick={() => setActive("snacks")}
            type="button"
          >
            Snacks
          </button>
        </div>

        <section className="meals-panel meals-panel--mobile">
          <div className={active === "meals" ? "meals-mobile-pane is-active" : "meals-mobile-pane is-hidden"}>
            <MealsList
              userId={user?.id}
              onLogClick={onSelectToLog}
              onEditClick={onEditMeal}
              title="Meals"
              headerAction={mealAddButton}
            />
          </div>
          <div className={active === "snacks" ? "meals-mobile-pane is-active" : "meals-mobile-pane is-hidden"}>
            <SnacksList
              userId={user?.id}
              onLogClick={onSelectToLog}
              onEditClick={onEditSnack}
              title="Snacks"
              headerAction={snackAddButton}
            />
          </div>
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
              onEditClick={onEditSnack}
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
      <Modal
        open={guestimateOpen}
        onClose={() => setGuestimateOpen(false)}
        title="Guestimate Meal"
      >
        <form className="guestimate-meal-form" onSubmit={saveGuestimate}>
          <label className="guestimate-meal-field">
            <span>Estimated calories</span>
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={guestimateCalories}
              onChange={(event) => setGuestimateCalories(event.target.value)}
              autoFocus
            />
          </label>
          <label className="guestimate-meal-field">
            <span>Date & Time</span>
            <input
              type="datetime-local"
              value={guestimateAt}
              onChange={(event) => setGuestimateAt(event.target.value)}
            />
          </label>
          {guestimateError && <div className="guestimate-meal-error">{guestimateError}</div>}
          <div className="guestimate-meal-actions">
            <button
              type="button"
              className="guestimate-meal-secondary"
              onClick={() => setGuestimateOpen(false)}
              disabled={guestimateSaving}
            >
              Cancel
            </button>
            <button type="submit" className="guestimate-meal-primary" disabled={guestimateSaving}>
              {guestimateSaving ? "Saving..." : "Save Guestimate"}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
