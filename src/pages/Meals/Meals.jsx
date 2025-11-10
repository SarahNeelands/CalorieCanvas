/**
 * MealsPage.jsx
 * High-level page for the Meals section.
 * Renders two tabs: Meals and Snacks, plus a "New" launcher to create new Meal/Snack.
 */
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from 'react-router-dom';
import LogMealModal from "../../components/Meals/LogMealModal.jsx";
import MealsList from "../../components/Meals/MealsList.jsx";
import SnacksList from "../../components/Meals/SnacksList.jsx";
import NewEntryLauncher from "../../components/NewEntryLauncher.jsx";
import NavBar from "../../components/NavBar";

export default function Meals({ user }) {
  const [active, setActive] = useState("meals"); // 'meals' | 'snacks'
  const [logOpen, setLogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const onSelectToLog = (item) => { setSelectedItem(item); setLogOpen(true); };

  const location = useLocation();
  const navigate = useNavigate();
  useEffect(()=>{
    if(location?.state?.openLogMeal){
      setLogOpen(true);
      try{ navigate(location.pathname, { replace: true, state: {} }); }catch(e){}
    }
  }, [location, navigate]);

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
        {active === "meals" ? <MealsList userId={user?.id} onLogClick={onSelectToLog} /> : <SnacksList userId={user?.id} onLogClick={onSelectToLog} />}
      </section>
      <LogMealModal open={logOpen} onClose={() => setLogOpen(false)} userId={user?.id} item={selectedItem} />
    </main>
  );
}
