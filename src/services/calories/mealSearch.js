import userMeals from "./userMeals.js";
export function findMealStatsById(userId, mealId) {
   const meals = mealsStatsById(userId);
   const meal = meals.find(m =>m.id===mealId);
   return meal || null;
}

export function getPortionForUnit(servingSizeList, targetUnit) {
  if (!Array.isArray(servingSizeList)) return null;

  const match = servingSizeList.find(item => item.unit === targetUnit);

  return match ? match.portion : null;
}