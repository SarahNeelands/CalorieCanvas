use async_trait::async_trait;
use crate::models::meal::Meal;

#[async_trait]
pub trait MealRepository {
    async fn get_all_meals(&self) -> Vec<Meal>;
    async fn get_all_users_meals(&self, user_id: &str) -> Vec<Meal>;
    async fn get_meals_by_date(&self) -> Vec<Meal>;
    async fn get_meal_by_id(&self, id: &str) -> Option<Meal>;
    async fn add_meal(&self, meal: &Meal) -> bool;
    async fn update_meal(&self, meal: &Meal) -> bool;
    async fn delete_meal(&self, id: &str) -> bool;
}