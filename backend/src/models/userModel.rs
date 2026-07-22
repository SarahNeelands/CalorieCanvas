#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User{
    pub id: String,
    pub name: String,
    pub birthday: String, //"YYYY-MM-DD"
    pub height_unit: String,
    pub height: f64,
    pub weight_unit: String,
    pub goal_type: f64,
    pub activity_level: i32,
    pub weights: Vec<WeightEntry>,
    pub calorie_goal: i32,
}
pub struct WeightEntry{
    pub date: String, //"YYYY-MM-DD"
    pub weight: f64,
    pub weight_unit: String,
}