use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CatalogItem {
    pub id: String,
    pub user_id: String,
    pub title: String,
    pub item_type: String,
    pub created_at: String,
    pub kcal_per_100g: f64,
    pub protein_g_per_100g: f64,
    pub carbs_g_per_100g: f64,
    pub fat_g_per_100g: f64,
    pub unit_conversions: serde_json::Value,
    pub food_id: Option<String>,
}
