/** LogMeal.jsx
 * Composition page that hosts MealDetails + Ingredients + MealSummary for building a meal.
 */
import NavBar from "../components/NavBar";

import React from "react";
export default function LogMeal({ user }) {
  return <div className="cc-container">LogMeal Page
    <NavBar profileImageSrc={user.avatar}/>
  </div>;
}
