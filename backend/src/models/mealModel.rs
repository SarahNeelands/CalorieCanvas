
pub struct MealEntry{
    pub date: String, //"YYYY-MM-DD"
    pub user_id: String,
    pub total_macros: Macro,
    pub total_micros: Micro,
    pub meals: Vec<Meal>,

}

pub struct Meal{
    pub id: String,
    pub meal_id: String,
    pub date_time: String, //"YYYY-MM-DD HH:MM:SS"
    pub macros: Macro,
    pub micros: Micro,
}

pub struct Macro{
    pub calories: f64,
    pub protein: f64,
    pub carbs: f64,
    pub fats: f64,
}

pub struct Micro{
    pub iron: f64,
    pub potassium: f64,
    pub sodium: f64,
    pub calculate_age
    pub vitamin_a: f64,
    pub vitamin_c: f64,
    pub fiber: f64,
    pub sugar: f64,
}