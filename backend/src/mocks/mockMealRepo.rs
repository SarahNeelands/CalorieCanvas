use async_trait::async_trait;
use crate::models::meal::Meal;
use crate::repos::mealRepo::MealRepository;

pub struct MockMealRepo;

#[async_trait]
impl MealRepository for MockMealRepo {
    async fn get_all_meals(&self) -> Vec<Meal> {
        vec![
            mock_meal_1(),
            mock_meal_2(),
        ]
    }
    async fn get_meals_by_date(&self, user_id: &str, date: &str) -> Vec<Meal> {
        let meals = self.get_all_meals().await;
        meals.into_iter()
        .filter(|m| m.user_id == user_id && &m.date_time[..6] == date)
        .collect()
    }

    async fn get-all_users_meals(&self, user_id: &str) -> Vec<Meal>{
        let meals = self.get_all_meals().await;
        meals.into_iter(|m| m.user_id == user_id).collect()
    }
    async fn get_meal_by_id(&self, id: &str) -> Option<Meal>{
        let meal.into_iter(|m| m.id == id).next()
    }
    async fn add_meal(&self, meal: &Meal) -> bool {
        println!("Mock add meal: {:?}", meal);
        true
    }
    async fn update_meal(&self, meal: &Meal) -> bool {
        println!("Mock update meal: {:?}", meal);
        true
    }
    async fn delete_meal(&self, id: &str) -> bool {
        println!("Mock delete meal with id: {}", id);
        true
    }
}