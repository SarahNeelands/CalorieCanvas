

// Calculate Just total Calories
export function calculateMealCalories(mealList) {
    if (!mealList || !Array.isArray(mealList)) return 0;
    return mealList.reduce((sum, meal) => {
        return sum + (meal.macros?.calories || 0);
    }, 0);
}


//calculate Macros: calories, protein, carbs, fats
export function calculateMealMacros(mealList) {
    if (!mealList|| !Array.isArray(mealList)) 
        {
            return { calories: 0, protein: 0, carbs: 0, fats: 0 };
        }
    return mealList.reduce((totals, meal) =>({ 
        calories:   totals.calories + (meal.macros?.calories || 0), 
        protein:    totals.protein  + (meal.macros?.protein || 0),
        carbs:      totals.carbs    + (meal.macros?.carbs || 0),
        fats:       totals.fats     + (meal.macros?.fats || 0)},
    { calories: 0, protein: 0, carbs: 0, fats: 0 }));
}


//calculate Micros: iron, potassium, sodium, calcium, vitaminA, vitaminC, fiber, sugar
export function calculateMealMicros(mealList){
    if (!mealList|| !Array.isArray(mealList))
    {
        return { iron: 0, potassium: 0, sodium: 0, calcium:0, 
            vitaminA: 0, vitaminC:0, fiber:0, sugar: 0 };
    }
    return mealList.reduce((totals, meal) =>({
        iron:       totals.iron      + (meal.micros?.iron || 0),
        potassium:  totals.potassium + (meal.micros?.potassium || 0),
        sodium:     totals.sodium    + (meal.micros?.sodium || 0),
        calcium:    totals.calcium   + (meal.micros?.calcium || 0),
        vitaminA:   totals.vitaminA  + (meal.micros?.vitaminA || 0),
        vitaminC:   totals.vitaminC  + (meal.micros?.vitaminC || 0),
        fiber:      totals.fiber     + (meal.micros?.fiber || 0),
        sugar:      totals.sugar     + (meal.micros?.sugar || 0) },
    { iron: 0, potassium: 0, sodium: 0, calcium:0, 
        vitaminA: 0, vitaminC:0, fiber:0, sugar: 0  
    }))
;}

export function calculateAndSaveDaysNutritionTotals(userId, date){
    const meals = mealsByDate(userId, date);
    const totalMacros = calculateMealMacros(meals);
    const totalMicros = calculateMealMicros(meals);
    console.log(`Nutrition totals for user ${userId} on ${date}:`);
    console.log('Total Macros:', totalMacros);
    console.log('Total Micros:', totalMicros);
    return saveDailyTotals(userId, dateStr, {totalMacros, totalMicros});
}

export function calculateAndSaveMeal(userId, mealId, unit, portion, timeStr) {
    const meal = findMealStatsById(userId, mealId);
    if (!meal) {
        console.warn(`Meal with id ${mealId} not found for user ${userId}`);
        return null;
    }

    // Get the base portion for this meal in the selected unit
    const mealUnit = getPortionForUnit(meal.servingSize, unit);
    if (!mealUnit) {
        console.warn(`Unit "${unit}" not found for meal ${mealId}`);
        return null;
    }

    // Now calculate scaled nutrients
    const calculatedMicros = {
        iron:       ((meal.micros?.iron ?? 0)      / mealUnit) * portion,
        potassium:  ((meal.micros?.potassium ?? 0) / mealUnit) * portion,
        sodium:     ((meal.micros?.sodium ?? 0)    / mealUnit) * portion,
        calcium:    ((meal.micros?.calcium ?? 0)   / mealUnit) * portion,
        vitaminA:   ((meal.micros?.vitaminA ?? 0)  / mealUnit) * portion,
        vitaminC:   ((meal.micros?.vitaminC ?? 0)  / mealUnit) * portion,
        fiber:      ((meal.micros?.fiber ?? 0)     / mealUnit) * portion,
        sugar:      ((meal.micros?.sugar ?? 0)     / mealUnit) * portion,
    };

    const calculatedMacros = {
        calories:   ((meal.macros?.calories ?? 0)  / mealUnit) * portion,
        protein:    ((meal.macros?.protein ?? 0)   / mealUnit) * portion,
        carbs:      ((meal.macros?.carbs ?? 0)     / mealUnit) * portion,
        fats:       ((meal.macros?.fat ?? 0)       / mealUnit) * portion,
    };

    // Return combined
    const result = {
        userId,
        mealId,
        unit,
        portion,
        time: timeStr,
        macros: calculatedMacros,
        micros: calculatedMicros,
    };

    return result;
}
