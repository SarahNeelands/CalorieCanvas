import {mockMealStats} from '../../Data/mockDatabase.js';
import { v4 as uuid } from "uuid";

//returns meal stats for user
export async function mealsStatsById(userId){
    return mockMealStats.filter(m => m.userId === userId);
}




// saves mealStats to user's meal list
export function saveMealStatsToUserMeals(userId, mealStats){
    const id = uuid();
    const duplicate = mockMealStats.findIndex(
    meal => meal.userId === userId && meal.id === id);
    while (duplicate !== -1) {
        id = uuid();
        duplicate = mockMealStats.findIndex(
        meal => meal.userId === userId && meal.id === id);
    }
    mealStats.id = id;
    mockMealStats.push(mealStats);
    return mealStats;
}