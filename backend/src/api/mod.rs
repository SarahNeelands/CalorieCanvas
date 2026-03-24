mod user_api;
pub use user_api::*;
use axum::{Router, routing::{patch, post}};
use axum::http::{HeaderValue, Method};
use crate::database::AppState;
use tower_http::cors::CorsLayer;

fn api_routes() -> Router<AppState> {
    Router::new()
        .route("/auth/signup", post(local_signup))
        .route("/auth/login", post(local_login))
        .route("/auth/session", post(local_session))
        .route("/catalog/items", post(create_catalog_item))
        .route("/catalog/items/list", post(list_catalog_items))
        .route("/catalog/items/search", post(search_catalog_items))
        .route("/create_profile", post(create_profile))
        .route("/add-weight-entry", post(add_user_weight_entry).put(add_user_weight_entry))
        .route("/add-height", patch(update_users_height))
        .route("/profile-setup-3", post(save_profile_step3))
        .route("/profile-setup-4", post(save_profile_step4))
}

pub fn create_routes(database: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin([
            "http://localhost:3000".parse::<HeaderValue>().unwrap(),
            "http://127.0.0.1:3000".parse::<HeaderValue>().unwrap(),
        ])
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::PATCH, Method::OPTIONS])
        .allow_headers(tower_http::cors::Any);

    Router::new()
        .nest("/api", api_routes())
        .with_state(database)
        .layer(cors)
}
