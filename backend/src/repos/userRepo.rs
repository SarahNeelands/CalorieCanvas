use async_trait::async_trait;
use crate::models::user::User;

#[async_trait]
pub trait UserRepository {
    async fn get_all_users(&self) -> Vec<User>;
    async fn get_user_by_id(&self, id: &str) -> Option<User>;
    async fn update_user_profile(&self, user: &User) -> bool;
    async fn update_user_calorie_goal(&self, id: &str, calorie_goal: i32) -> bool;
    async fn fetch_all_users_weight(&self, user_id: &str) -> Vec<(String, f64)>;
    async fn add_user_weight_entry(&self, user_id: &str, weight_entry: WeightEntry) -> bool;
    async fn update_user_goal_calorie(&self, user_id: &str, calorie_goal:i32)-> bool;
}
