mod user_api;
pub use user_api::*;
use axum::{Router, routing::{post, get}};
use crate::database::mock_db::MockDB;


pub fn create_routes(database: MockDB) -> Router {
    Router::new()
        .route("/create_profile", post(create_profile))
        .route("/add-weight-entry", post(add_user_weight_entry))
        .route("/add-height", patch(update_users_height))
        .route("/profile-setup-3", post(save_profile_step3))
        .route("/profile-setup-4", post(save_profile_step4))
        .with_state(database)
}