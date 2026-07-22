use async_trait::async_trait;
use crate::models::user::{User, WeightEntry};
use crate::repos::userRepo::UserRepository;


pub struct GoalCalculation;

impl GoalCalculation{
    pub async fn calculate_daily_calorie_goals<R: UserRepository>(repo: &R, user_id: &str, activity_factor: f64) -> bool
    {
        // Placeholder logic for daily calorie goal calculation
        let user = match repo.get_user_by_id(user_id).await {
            Some(u) => u,
            None => return false,
        };
        let weight = repo.fetch_all_users_weight(user_id).await;
        if weight.is_empty(){
            return false;
        }
        
        let current_weight = Self::find_user_current_weight(&weight);
        let age = Self::calculate_age(&user.birthday);

        let mut goal = Self::calculate_BMR(&user, age, current_weight);
        if goal < 1500 && user.gender == "male"
            { goal = 1500;}
        if goal < 1200
            {goal = 1200;}

        repo.update_user_goal_calorie(user_id, goal as i32).await;
        return true;
    }


    pub fn calculate_BMR(user: &User, age_years: i32, weight: f64) -> f64 {
        match user.gender.as_str(){
            "female" => return Self::women_BMR(weight, user.height, age_years)* user.activity_level as f64;
            "male" => return Self::men_BMR(weight, user.height, age_years)* user.activity_level as f64;
            _ => return Self::hormone_transition_BMR(weight, user.height, age_years)* user.activity_level as f64;
        }
    }


    pub fn women_BMR(weight_kg: f64, height_cm: f64, age_years: i32) -> f64 
    {
        return (10 * weight_kg) + (6.25 * height_cm) - (5* age_years as f64) -161.0;
    }
    pub fn men_BMR(weight_kg: f64, height_cm: f64, age_years: i32) -> f64 
    {
        return (10 * weight_kg) + (6.25 * height_cm) - (5* age_years as f64) +5.0;
    }

    pub fn hormone_transition_BMR(weight_kg: f64, height_cm: f64, age_years: i32) -> f64 
    {
        let male_bmr = Self::men_BMR(weight_kg, height_cm, age_years);
        let female_bmr = Self::women_BMR(weight_kg, height_cm, age_years);
        return (male_bmr + female_bmr) / 2.0;  
    }

    pub fn calculate_age(birthday: &str) -> i32 {
        use chrono::{NaiveDate, Utc};
        let birth_date = NaiveDate::parse_from_str(birthday, "%Y-%m-%d").unwrap();
        let today = Utc::today().naive_utc();
        let age = today.year() - birth_date.year();
        if today.ordinal() < birth_date.ordinal() {
            return age - 1;
        }
        return age;
    }

    pub fn find_user_current_weight(weights: &[(String, f64)]) -> f64 {
        let latest_weight = weights
        .iter()
        .max_by(|a, b| a.0.cmp(&b.0)).unwrap();
        return latest_weight.1;
    }

}

    /*
    Citations for BMR equations

    Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO. A new predictive equation for resting energy 
    expenditure in healthy individuals. American Journal of Clinical Nutrition. 
    1990;51(2):241-247. doi:10.1093/ajcn/51.2.241.
    */