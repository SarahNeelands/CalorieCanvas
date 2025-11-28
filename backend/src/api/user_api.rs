use axum::{Json, extract::State};
use uuid::Uuid;
use chrono::Local;

use crate::models::{User, WeightEntry};
use crate::database::mock_db::MockDB;

#[derive(serde::Deserialize)]
pub struct IncomingProfile {
    pub name: String,
    pub birthday: String,
    pub height_unit: String,
    pub height: f64,
    pub weight_unit: String,
    pub goal_type: f64,
    pub activity_level: i32,
    pub weight: f64,
}
#[derive(serde::Deserialize)]
pub struct ProfileCreate {
    pub id: String,   // Supabase user_id
}
#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct IncomingWeight {
    pub user_id: String,
    pub weight: f64,
    pub weight_unit: String,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct User {
    pub id: String,
    pub name: String,
    pub birthday: String,
    pub height_unit: String,
    pub height: f64,
    pub weight_unit: String,
    pub goal_type: f64,
    pub activity_level: i32,
    pub weights: Vec<WeightEntry>,
    pub calorie_goal: i32,}

pub async fn save_profile(
    State(db): State<MockDB>,
    Json(body): Json<IncomingProfile>,
    ) -> Json<User> 
{

    let new_user = User {
        id: Uuid::new_v4().to_string(),
        name: body.name,
        birthday: body.birthday,
        height_unit: body.height_unit,
        height: body.height,
        weight_unit: body.weight_unit,
        goal_type: body.goal_type,
        activity_level: body.activity_level,
        // first weight entry
        weights: vec![
            WeightEntry {
                date: chrono::Local::now().format("%Y-%m-%d").to_string(),
                weight: body.weight,
            }
        ],
        calorie_goal: 0, // you will calculate this later
    };

    db.add_user(new_user.clone());

    Json(new_user)
}

pub async fn create_profile(
    State(db): State<MockDB>,
    Json(body): Json<ProfileCreate>,
    ) -> Json<User> 
{
    let user =User {
        id: body.id.clone(),
        name: "".to_string(),
        birthday: "".to_string(),
        height_unit: "".to_string(),
        height: 0.0,
        weight_unit: "".to_string(),
        goal_type: 0.0,
        activity_level: 0,
        weights: vec![],
        calorie_goal: 0,
    };

    db.add_user(user.clone());
    Json(user)
}

pub async fn add_user_weight_entry(
    State(db): State<MockDB>,
    Json(body): Json<IncomingWeight>,
    ) -> Json<bool> 
{
    let entry = WeightEntry {
        date: Local::now().format("%Y-%m-%d").to_string(),
        weight: body.weight
    };
    let result = db.add_weight_entry(&body.user_id, entry);
    Json(result)
}
