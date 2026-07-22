pub mod mock_db;
pub mod seed_data;
pub mod sqlite_db;

use std::env;

use crate::models::{CatalogItem, User, WeightEntry};
use mock_db::MockDB;
use seed_data::SHARED_CATALOG_USER_ID;
use sqlite_db::SqliteDB;

#[derive(Clone)]
pub enum Database {
    Mock(MockDB),
    Sqlite(SqliteDB),
}

#[derive(Clone)]
pub struct AppState {
    db: Database,
}

impl AppState {
    pub fn from_env() -> Self {
        let backend = env::var("CALORIE_CANVAS_DB").unwrap_or_else(|_| "sqlite".to_string());

        if backend.eq_ignore_ascii_case("mock") {
            return Self {
                db: Database::Mock(MockDB::new()),
            };
        }

        let path = env::var("CALORIE_CANVAS_DB_PATH")
            .unwrap_or_else(|_| "data/calorie_canvas.sqlite3".to_string());

        let sqlite = SqliteDB::new(&path).unwrap_or_else(|err| {
            panic!("failed to initialize sqlite database at {path}: {err}");
        });

        Self {
            db: Database::Sqlite(sqlite),
        }
    }

    pub fn upsert_user(&self, user: User) -> Result<User, String> {
        match &self.db {
            Database::Mock(db) => {
                db.update_user(user.clone());
                if db.get_user(&user.id).is_none() {
                    db.add_user(user.clone());
                }
                Ok(user)
            }
            Database::Sqlite(db) => {
                db.upsert_user(&user).map_err(|e| e.to_string())?;
                Ok(user)
            }
        }
    }

    pub fn get_user(&self, user_id: &str) -> Result<Option<User>, String> {
        match &self.db {
            Database::Mock(db) => Ok(db.get_user(user_id)),
            Database::Sqlite(db) => db.get_user(user_id).map_err(|e| e.to_string()),
        }
    }

    pub fn add_weight_entry(&self, user_id: &str, entry: WeightEntry) -> Result<bool, String> {
        match &self.db {
            Database::Mock(db) => Ok(db.add_weight_entry(user_id, entry)),
            Database::Sqlite(db) => db.add_weight_entry(user_id, &entry).map_err(|e| e.to_string()),
        }
    }

    pub fn create_auth_user(&self, email: &str, password: &str) -> Result<String, String> {
        match &self.db {
            Database::Mock(db) => db.create_auth_user(email, password),
            Database::Sqlite(db) => db.create_auth_user(email, password),
        }
    }

    pub fn verify_auth_user(&self, email: &str, password: &str) -> Result<Option<String>, String> {
        match &self.db {
            Database::Mock(db) => Ok(db.verify_auth_user(email, password)),
            Database::Sqlite(db) => db.verify_auth_user(email, password),
        }
    }

    pub fn has_auth_user(&self, user_id: &str) -> Result<bool, String> {
        match &self.db {
            Database::Mock(db) => Ok(db.has_auth_user(user_id)),
            Database::Sqlite(db) => db.has_auth_user(user_id),
        }
    }

    pub fn create_catalog_item(&self, item: CatalogItem) -> Result<CatalogItem, String> {
        match &self.db {
            Database::Mock(db) => Ok(db.create_catalog_item(item)),
            Database::Sqlite(db) => db.create_catalog_item(&item),
        }
    }

    pub fn list_catalog_items(&self, user_id: &str, item_type: &str) -> Result<Vec<CatalogItem>, String> {
        match &self.db {
            Database::Mock(db) => Ok(db.list_catalog_items(user_id, item_type)),
            Database::Sqlite(db) => db.list_catalog_items(user_id, item_type, SHARED_CATALOG_USER_ID),
        }
    }

    pub fn search_catalog_items(&self, user_id: &str, item_type: &str, query: &str) -> Result<Vec<CatalogItem>, String> {
        match &self.db {
            Database::Mock(db) => Ok(db.search_catalog_items(user_id, item_type, query)),
            Database::Sqlite(db) => db.search_catalog_items(user_id, item_type, query, SHARED_CATALOG_USER_ID),
        }
    }
}
