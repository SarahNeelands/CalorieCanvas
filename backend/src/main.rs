
use axum::{Router};

mod api;
mod database; // Sarah Rust Notes includes everythign in the database folder
mod models;

use crate::database::mock_db::MockDB;



#[tokio::main] // want to use async code
async fn main() {
    let database = MockDB::new();
    let app = api::create_routes(database);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3001")
        .await
        .expect("Failed to bind port 3001");
    axum::serve(listener, app)
        .await
        .expect("Server crashed");
}
