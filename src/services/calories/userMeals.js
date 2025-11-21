import mockDatabase from "../Data/mockDatabase.js";
import { v4 as uuid } from "uuid";

// returns all of users meals
export async function mealsById(userId){
    return mockMeals.filter(m => m.id === userId);
}
export async function mealsStatsById(userId){
    return mockMeals.filter(m => m.userId === userId);
}

export async function mealsByDate(userId, dateStr)
{
    return mockMeals.filter(m => m.userId === userId && m.date === dateStr);
}

export function saveDailyTotals(userId, dateStr, totals){
    const index = dailyTotals.findIndex(
    entry => entry.userId === userId && entry.date === dateStr);
    if (index !== -1) {
        // Update existing
        dailyTotals[index] = {
        userId,
        date: dateStr,
        macros: totals.macros,
        micros: totals.micros
        };
        return dailyTotals[index];
    }
    const newEntry = {
        userId,
        date: dateStr,
        macros: totals.macros,
        micros: totals.micros
    };
    dailyTotals.push(newEntry);
    return newEntry;
}

export function saveMealToDailyLog(userId, mealEntry){
    const id = uuid();
    const duplicate = mockMealsLog.findIndex(
    meal => meal.userId === userId && meal.id === id);
    while (duplicate !== -1) {
        id = uuid();
        duplicate = mockMealsLog.findIndex(
        meal => meal.userId === userId && meal.id === id);
    }
    mealEntry.mealId = id;
    dailyTotals.push(mealEntry);
    return mealEntry;;
}