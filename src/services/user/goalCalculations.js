
import { fetchUserById } from "../user/userProfile.js";
import { updateUserCalorieGoal } from "../user/userProfile.js";

//
export function calculateDailyCalorieGoals(userId, activityFactor){
    const user = fetchUserById(userId);
    if (!user) {
        throw new Error("User not found");
    }
    const goal = calculateDailyCaloricNeeds(user.gender, user.activityFactor) - user.goalType;
    // safe minimum safe guards
    if (goal < 1500 && user.gender ==="male"){return 1500;}
    if (goal < 1200){return 1200;}
    user.calorieGoal = goal;
    updateUserCalorieGoal(userId, user)
    return goal;
    }
    


// Calculate daily caloric needs based on user profile and activity factor
export function calculateDailyCaloricNeeds(gender, activityFactor) {

    if(gender ==='female'){
        return womenBMR(user.weightKg, user.heightCm, user.ageYears)* activityFactor;
    }
    if (gender ==='male'){
        return menBMR(user.weightKg, user.heightCm, user.ageYears)* activityFactor;
    }  
    return trangenderBMR(user.weightKg, user.heightCm, user.ageYears) * activityFactor;
}

/*
Citations for women BMR 

Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO. A new predictive equation for resting energy 
expenditure in healthy individuals. American Journal of Clinical Nutrition. 
1990;51(2):241-247. doi:10.1093/ajcn/51.2.241.
*/
export function womenBMR(weightKg, heightCm, ageYears) {
    return (10 * weightKg) + (6.25 * heightCm) - (5 * ageYears) - 161;
}


/*
Citations for men BMR 

Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO. A new predictive equation for resting energy 
expenditure in healthy individuals. American Journal of Clinical Nutrition. 
1990;51(2):241-247. doi:10.1093/ajcn/51.2.241.
*/
export function menBMR(weightKg, heightCm, ageYears) {
    return (10 * weightKg) + (6.25 * heightCm) - (5 * ageYears) + 5;
}


/*
Citations for men BMR 

Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO. A new predictive equation for resting energy 
expenditure in healthy individuals. American Journal of Clinical Nutrition. 
1990;51(2):241-247. doi:10.1093/ajcn/51.2.241.
*/
export function trangenderBMR(weightKg, heightCm, ageYears) {
    const maleBMR = menBMR(weightKg, heightCm, ageYears);
    const femaleBMR = womenBMR(weightKg, heightCm, ageYears);
    return (maleBMR + femaleBMR) / 2;
}


