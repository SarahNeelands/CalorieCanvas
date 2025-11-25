import {mockMeals} from "../Data/mockDatabase.js";
import { v4 as uuid } from "uuid";

// returns all of users meals
export async function mealsById(userId){
    return mockMeals.filter(m => m.id === userId);
}

//
export async function mealsByDate(userId, dateStr)
{
    return mockMeals.filter(m => m.userId === userId && m.date === dateStr);
}


// saves meal entry to user's daily log
export function saveMealToDailyLog(userId, mealEntry){
    const id = uuid();
    const duplicate = mockMeals.findIndex(
    meal => meal.userId === userId && meal.id === id);
    while (duplicate !== -1) {
        id = uuid();
        duplicate = mockMeals.findIndex(
        meal => meal.userId === userId && meal.id === id);
    }
    mealEntry.mealId = id;
    mockMeals.push(mealEntry);
    return mealEntry;;
}

