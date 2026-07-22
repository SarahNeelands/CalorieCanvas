use axum::{Json, extract::State, http::StatusCode};
use chrono::Local;

use crate::models::{CatalogItem, User, WeightEntry};
use crate::database::AppState;

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

#[derive(serde::Deserialize)]
pub struct LocalAuthRequest {
    pub email: String,
    pub password: String,
}

#[derive(serde::Serialize)]
pub struct LocalAuthResponse {
    pub user_id: String,
}

#[derive(serde::Serialize)]
pub struct LocalSessionResponse {
    pub authenticated: bool,
}

#[derive(serde::Deserialize)]
pub struct LocalSessionRequest {
    pub user_id: String,
}

#[derive(serde::Deserialize)]
pub struct CatalogItemRequest {
    pub user_id: String,
    pub title: String,
    pub item_type: String,
    pub kcal_per_100g: f64,
    pub protein_g_per_100g: f64,
    pub carbs_g_per_100g: f64,
    pub fat_g_per_100g: f64,
    pub unit_conversions: serde_json::Value,
    pub food_id: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct CatalogListRequest {
    pub user_id: String,
    pub item_type: String,
}

#[derive(serde::Deserialize)]
pub struct CatalogSearchRequest {
    pub user_id: String,
    pub item_type: String,
    pub query: String,
}
#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct IncomingWeight {
    pub user_id: String,
    pub weight: f64,
    pub weight_unit: String,
}

#[derive(serde::Deserialize)]
pub struct IncomingHeight {
    pub user_id: String,
    pub height: f64,
    pub height_unit: String,
}

#[derive(serde::Deserialize)]
pub struct IncomingProfileStep3 {
    pub user_id: String,
    pub goal_type: f64,
    pub activity_level: i32,
}

#[derive(serde::Deserialize)]
pub struct IncomingProfileStep4 {
    pub user_id: String,
    pub calorie_goal: i32,
}

pub async fn save_profile(
    State(db): State<AppState>,
    Json(body): Json<IncomingProfile>,
    ) -> Result<Json<User>, (StatusCode, String)>
{
    let weight_unit = body.weight_unit.clone();

    let new_user = User {
        id: uuid::Uuid::new_v4().to_string(),
        name: body.name,
        birthday: body.birthday,
        height_unit: body.height_unit,
        height: body.height,
        weight_unit: weight_unit.clone(),
        goal_type: body.goal_type,
        activity_level: body.activity_level,
        // first weight entry
        weights: vec![
            WeightEntry {
                date: chrono::Local::now().format("%Y-%m-%d").to_string(),
                weight: body.weight,
                weight_unit,
            }
        ],
        calorie_goal: 0, // you will calculate this later
    };

    let user = db
        .upsert_user(new_user)
        .map_err(internal_error)?;

    Ok(Json(user))
}

pub async fn create_profile(
    State(db): State<AppState>,
    Json(body): Json<ProfileCreate>,
    ) -> Result<Json<User>, (StatusCode, String)>
{
    let user = User {
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

    let user = db.upsert_user(user).map_err(internal_error)?;
    Ok(Json(user))
}

pub async fn local_signup(
    State(db): State<AppState>,
    Json(body): Json<LocalAuthRequest>,
) -> Result<Json<LocalAuthResponse>, (StatusCode, String)> {
    let email = body.email.trim().to_lowercase();
    let password = body.password;

    if email.is_empty() || password.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Email and password are required.".to_string()));
    }

    let user_id = db
        .create_auth_user(&email, &password)
        .map_err(|message| (StatusCode::BAD_REQUEST, message))?;

    Ok(Json(LocalAuthResponse { user_id }))
}

pub async fn local_login(
    State(db): State<AppState>,
    Json(body): Json<LocalAuthRequest>,
) -> Result<Json<LocalAuthResponse>, (StatusCode, String)> {
    let email = body.email.trim().to_lowercase();
    let password = body.password;

    let user_id = db
        .verify_auth_user(&email, &password)
        .map_err(internal_error)?
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Invalid email or password.".to_string()))?;

    Ok(Json(LocalAuthResponse { user_id }))
}

pub async fn local_session(
    State(db): State<AppState>,
    Json(body): Json<LocalSessionRequest>,
) -> Result<Json<LocalSessionResponse>, (StatusCode, String)> {
    let authenticated = db.has_auth_user(&body.user_id).map_err(internal_error)?;
    Ok(Json(LocalSessionResponse { authenticated }))
}

pub async fn create_catalog_item(
    State(db): State<AppState>,
    Json(body): Json<CatalogItemRequest>,
) -> Result<Json<CatalogItem>, (StatusCode, String)> {
    let item = CatalogItem {
        id: uuid::Uuid::new_v4().to_string(),
        user_id: body.user_id,
        title: body.title,
        item_type: body.item_type,
        created_at: chrono::Utc::now().to_rfc3339(),
        kcal_per_100g: body.kcal_per_100g,
        protein_g_per_100g: body.protein_g_per_100g,
        carbs_g_per_100g: body.carbs_g_per_100g,
        fat_g_per_100g: body.fat_g_per_100g,
        unit_conversions: body.unit_conversions,
        food_id: body.food_id,
    };

    let item = db.create_catalog_item(item).map_err(internal_error)?;
    Ok(Json(item))
}

pub async fn list_catalog_items(
    State(db): State<AppState>,
    Json(body): Json<CatalogListRequest>,
) -> Result<Json<Vec<CatalogItem>>, (StatusCode, String)> {
    let items = db
        .list_catalog_items(&body.user_id, &body.item_type)
        .map_err(internal_error)?;
    Ok(Json(items))
}

pub async fn search_catalog_items(
    State(db): State<AppState>,
    Json(body): Json<CatalogSearchRequest>,
) -> Result<Json<Vec<CatalogItem>>, (StatusCode, String)> {
    let items = db
        .search_catalog_items(&body.user_id, &body.item_type, &body.query)
        .map_err(internal_error)?;
    Ok(Json(items))
}

pub async fn add_user_weight_entry(
    State(db): State<AppState>,
    Json(body): Json<IncomingWeight>,
    ) -> Result<Json<bool>, (StatusCode, String)>
{
    let entry = WeightEntry {
        date: Local::now().format("%Y-%m-%d").to_string(),
        weight: body.weight,
        weight_unit: body.weight_unit,
    };
    let result = db
        .add_weight_entry(&body.user_id, entry)
        .map_err(internal_error)?;
    Ok(Json(result))
}

pub async fn update_users_height(
    State(db): State<AppState>,
    Json(body): Json<IncomingHeight>,
) -> Result<Json<User>, (StatusCode, String)> {
    let mut user = db
        .get_user(&body.user_id)
        .map_err(internal_error)?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "User not found".to_string()))?;

    user.height = body.height;
    user.height_unit = body.height_unit;

    let user = db.upsert_user(user).map_err(internal_error)?;
    Ok(Json(user))
}

pub async fn save_profile_step3(
    State(db): State<AppState>,
    Json(body): Json<IncomingProfileStep3>,
) -> Result<Json<User>, (StatusCode, String)> {
    let mut user = db
        .get_user(&body.user_id)
        .map_err(internal_error)?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "User not found".to_string()))?;

    user.goal_type = body.goal_type;
    user.activity_level = body.activity_level;

    let user = db.upsert_user(user).map_err(internal_error)?;
    Ok(Json(user))
}

pub async fn save_profile_step4(
    State(db): State<AppState>,
    Json(body): Json<IncomingProfileStep4>,
) -> Result<Json<User>, (StatusCode, String)> {
    let mut user = db
        .get_user(&body.user_id)
        .map_err(internal_error)?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "User not found".to_string()))?;

    user.calorie_goal = body.calorie_goal;

    let user = db.upsert_user(user).map_err(internal_error)?;
    Ok(Json(user))
}

fn internal_error(message: String) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, message)
}
