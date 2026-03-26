use std::path::Path;
use std::sync::{Arc, Mutex};

use rusqlite::{Connection, OptionalExtension, params};

use crate::models::{CatalogItem, User, WeightEntry};
use crate::database::seed_data::shared_catalog_items;

#[derive(Clone)]
pub struct SqliteDB {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteDB {
    pub fn new(path: &str) -> Result<Self, rusqlite::Error> {
        if let Some(parent) = Path::new(path).parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let conn = Connection::open(path)?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.init()?;
        Ok(db)
    }

    fn init(&self) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT '',
                birthday TEXT NOT NULL DEFAULT '',
                height_unit TEXT NOT NULL DEFAULT '',
                height REAL NOT NULL DEFAULT 0,
                weight_unit TEXT NOT NULL DEFAULT '',
                goal_type REAL NOT NULL DEFAULT 0,
                activity_level INTEGER NOT NULL DEFAULT 0,
                calorie_goal INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS weight_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                date TEXT NOT NULL,
                weight REAL NOT NULL,
                weight_unit TEXT NOT NULL DEFAULT '',
                FOREIGN KEY (user_id) REFERENCES users (id)
            );

            CREATE TABLE IF NOT EXISTS auth_users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS catalog_items (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                item_type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                kcal_per_100g REAL NOT NULL DEFAULT 0,
                protein_g_per_100g REAL NOT NULL DEFAULT 0,
                carbs_g_per_100g REAL NOT NULL DEFAULT 0,
                fat_g_per_100g REAL NOT NULL DEFAULT 0,
                unit_conversions TEXT NOT NULL DEFAULT '{}',
                food_id TEXT NULL
            );
            ",
        )?;
        drop(conn);
        self.seed_shared_catalog_items()?;
        Ok(())
    }

    fn seed_shared_catalog_items(&self) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();

        for item in shared_catalog_items() {
            conn.execute(
                "
                INSERT OR IGNORE INTO catalog_items (
                    id, user_id, title, item_type, created_at, kcal_per_100g,
                    protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, unit_conversions, food_id
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                ",
                params![
                    item.id,
                    item.user_id,
                    item.title,
                    item.item_type,
                    item.created_at,
                    item.kcal_per_100g,
                    item.protein_g_per_100g,
                    item.carbs_g_per_100g,
                    item.fat_g_per_100g,
                    item.unit_conversions.to_string(),
                    item.food_id
                ],
            )?;
        }

        Ok(())
    }

    pub fn upsert_user(&self, user: &User) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "
            INSERT INTO users (
                id, name, birthday, height_unit, height, weight_unit, goal_type, activity_level, calorie_goal
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                birthday = excluded.birthday,
                height_unit = excluded.height_unit,
                height = excluded.height,
                weight_unit = excluded.weight_unit,
                goal_type = excluded.goal_type,
                activity_level = excluded.activity_level,
                calorie_goal = excluded.calorie_goal
            ",
            params![
                user.id,
                user.name,
                user.birthday,
                user.height_unit,
                user.height,
                user.weight_unit,
                user.goal_type,
                user.activity_level,
                user.calorie_goal
            ],
        )?;
        Ok(())
    }

    pub fn get_user(&self, user_id: &str) -> Result<Option<User>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();

        let mut user = conn
            .query_row(
                "
                SELECT id, name, birthday, height_unit, height, weight_unit, goal_type, activity_level, calorie_goal
                FROM users
                WHERE id = ?1
                ",
                params![user_id],
                |row| {
                    Ok(User {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        birthday: row.get(2)?,
                        height_unit: row.get(3)?,
                        height: row.get(4)?,
                        weight_unit: row.get(5)?,
                        goal_type: row.get(6)?,
                        activity_level: row.get(7)?,
                        calorie_goal: row.get(8)?,
                        weights: vec![],
                    })
                },
            )
            .optional()?;

        if let Some(ref mut existing) = user {
            let mut stmt = conn.prepare(
                "
                SELECT date, weight, weight_unit
                FROM weight_entries
                WHERE user_id = ?1
                ORDER BY date DESC, id DESC
                ",
            )?;

            let rows = stmt.query_map(params![user_id], |row| {
                Ok(WeightEntry {
                    date: row.get(0)?,
                    weight: row.get(1)?,
                    weight_unit: row.get(2)?,
                })
            })?;

            existing.weights = rows.collect::<Result<Vec<_>, _>>()?;
        }

        Ok(user)
    }

    pub fn add_weight_entry(&self, user_id: &str, entry: &WeightEntry) -> Result<bool, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let exists: Option<String> = conn
            .query_row(
                "SELECT id FROM users WHERE id = ?1",
                params![user_id],
                |row| row.get(0),
            )
            .optional()?;

        if exists.is_none() {
            return Ok(false);
        }

        conn.execute(
            "
            INSERT INTO weight_entries (user_id, date, weight, weight_unit)
            VALUES (?1, ?2, ?3, ?4)
            ",
            params![user_id, entry.date, entry.weight, entry.weight_unit],
        )?;

        Ok(true)
    }

    pub fn create_auth_user(&self, email: &str, password: &str) -> Result<String, String> {
        let conn = self.conn.lock().unwrap();
        let existing: Result<String, _> = conn.query_row(
            "SELECT id FROM auth_users WHERE lower(email) = lower(?1)",
            params![email],
            |row| row.get(0),
        );

        if existing.is_ok() {
            return Err("An account with that email already exists.".to_string());
        }

        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "
            INSERT INTO auth_users (id, email, password)
            VALUES (?1, ?2, ?3)
            ",
            params![id, email, password],
        )
        .map_err(|e| e.to_string())?;

        Ok(id)
    }

    pub fn verify_auth_user(&self, email: &str, password: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "
            SELECT id
            FROM auth_users
            WHERE lower(email) = lower(?1) AND password = ?2
            ",
            params![email, password],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())
    }

    pub fn has_auth_user(&self, user_id: &str) -> Result<bool, String> {
        let conn = self.conn.lock().unwrap();
        let found = conn
            .query_row(
                "SELECT id FROM auth_users WHERE id = ?1",
                params![user_id],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;

        Ok(found.is_some())
    }

    pub fn create_catalog_item(&self, item: &CatalogItem) -> Result<CatalogItem, String> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "
            INSERT INTO catalog_items (
                id, user_id, title, item_type, created_at, kcal_per_100g,
                protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, unit_conversions, food_id
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            ",
            params![
                item.id,
                item.user_id,
                item.title,
                item.item_type,
                item.created_at,
                item.kcal_per_100g,
                item.protein_g_per_100g,
                item.carbs_g_per_100g,
                item.fat_g_per_100g,
                item.unit_conversions.to_string(),
                item.food_id
            ],
        )
        .map_err(|e| e.to_string())?;

        Ok(item.clone())
    }

    pub fn list_catalog_items(&self, user_id: &str, item_type: &str, shared_user_id: &str) -> Result<Vec<CatalogItem>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "
            SELECT id, user_id, title, item_type, created_at, kcal_per_100g,
                   protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, unit_conversions, food_id
            FROM catalog_items
            WHERE item_type = ?2 AND (user_id = ?1 OR user_id = ?3)
            ORDER BY created_at DESC
            ",
        ).map_err(|e| e.to_string())?;

        let rows = stmt.query_map(params![user_id, item_type, shared_user_id], |row| {
            let unit_conversions_raw: String = row.get(9)?;
            Ok(CatalogItem {
                id: row.get(0)?,
                user_id: row.get(1)?,
                title: row.get(2)?,
                item_type: row.get(3)?,
                created_at: row.get(4)?,
                kcal_per_100g: row.get(5)?,
                protein_g_per_100g: row.get(6)?,
                carbs_g_per_100g: row.get(7)?,
                fat_g_per_100g: row.get(8)?,
                unit_conversions: serde_json::from_str(&unit_conversions_raw).unwrap_or(serde_json::json!({})),
                food_id: row.get(10)?,
            })
        }).map_err(|e| e.to_string())?;

        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn search_catalog_items(&self, user_id: &str, item_type: &str, query: &str, shared_user_id: &str) -> Result<Vec<CatalogItem>, String> {
        let conn = self.conn.lock().unwrap();
        let pattern = format!("%{}%", query.to_lowercase());
        let mut stmt = conn.prepare(
            "
            SELECT id, user_id, title, item_type, created_at, kcal_per_100g,
                   protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, unit_conversions, food_id
            FROM catalog_items
            WHERE item_type = ?2 AND (user_id = ?1 OR user_id = ?4) AND lower(title) LIKE ?3
            ORDER BY created_at DESC
            ",
        ).map_err(|e| e.to_string())?;

        let rows = stmt.query_map(params![user_id, item_type, pattern, shared_user_id], |row| {
            let unit_conversions_raw: String = row.get(9)?;
            Ok(CatalogItem {
                id: row.get(0)?,
                user_id: row.get(1)?,
                title: row.get(2)?,
                item_type: row.get(3)?,
                created_at: row.get(4)?,
                kcal_per_100g: row.get(5)?,
                protein_g_per_100g: row.get(6)?,
                carbs_g_per_100g: row.get(7)?,
                fat_g_per_100g: row.get(8)?,
                unit_conversions: serde_json::from_str(&unit_conversions_raw).unwrap_or(serde_json::json!({})),
                food_id: row.get(10)?,
            })
        }).map_err(|e| e.to_string())?;

        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }
}
