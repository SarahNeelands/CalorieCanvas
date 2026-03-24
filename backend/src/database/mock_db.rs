use crate::models::{CatalogItem, User, WeightEntry};
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct MockAuthUser {
    pub id: String,
    pub email: String,
    pub password: String,
}

#[derive(Clone)]
pub struct MockDB {
    pub users: Arc<Mutex<Vec<User>>>,
    pub auth_users: Arc<Mutex<Vec<MockAuthUser>>>,
    pub catalog_items: Arc<Mutex<Vec<CatalogItem>>>,
}

impl MockDB {
    pub fn new() -> Self {
        Self {
            users: Arc::new(Mutex::new(vec![])),
            auth_users: Arc::new(Mutex::new(vec![])),
            catalog_items: Arc::new(Mutex::new(vec![])),
        }
    }

    pub fn add_user(&self, user: User) {
        let mut db = self.users.lock().unwrap();
        db.push(user);
    }

    pub fn update_user(&self, updated: User) {
        let mut db = self.users.lock().unwrap();
        if let Some(existing) = db.iter_mut().find(|u| u.id == updated.id) {
            *existing = updated;
        }
    }

    pub fn get_user(&self, id: &str) -> Option<User> {
        let db = self.users.lock().unwrap();
        db.iter().find(|u| u.id == id).cloned()
    }

    pub fn add_weight_entry(&self, id: &str, weight: WeightEntry) -> bool {
        let mut db = self.users.lock().unwrap();
        if let Some(user) = db.iter_mut().find(|u| u.id == id) {
            user.weights.push(weight);
            return true;
        }
        false
    }

    pub fn create_auth_user(&self, email: &str, password: &str) -> Result<String, String> {
        let mut auth = self.auth_users.lock().unwrap();
        if auth.iter().any(|user| user.email.eq_ignore_ascii_case(email)) {
            return Err("An account with that email already exists.".to_string());
        }

        let id = uuid::Uuid::new_v4().to_string();
        auth.push(MockAuthUser {
            id: id.clone(),
            email: email.to_string(),
            password: password.to_string(),
        });

        Ok(id)
    }

    pub fn verify_auth_user(&self, email: &str, password: &str) -> Option<String> {
        let auth = self.auth_users.lock().unwrap();
        auth.iter()
            .find(|user| user.email.eq_ignore_ascii_case(email) && user.password == password)
            .map(|user| user.id.clone())
    }

    pub fn has_auth_user(&self, user_id: &str) -> bool {
        let auth = self.auth_users.lock().unwrap();
        auth.iter().any(|user| user.id == user_id)
    }

    pub fn create_catalog_item(&self, item: CatalogItem) -> CatalogItem {
        let mut items = self.catalog_items.lock().unwrap();
        items.push(item.clone());
        item
    }

    pub fn list_catalog_items(&self, user_id: &str, item_type: &str) -> Vec<CatalogItem> {
        let items = self.catalog_items.lock().unwrap();
        items
            .iter()
            .filter(|item| item.user_id == user_id && item.item_type == item_type)
            .cloned()
            .collect()
    }

    pub fn search_catalog_items(&self, user_id: &str, item_type: &str, query: &str) -> Vec<CatalogItem> {
        let q = query.to_lowercase();
        let items = self.catalog_items.lock().unwrap();
        items
            .iter()
            .filter(|item| {
                item.user_id == user_id
                    && item.item_type == item_type
                    && item.title.to_lowercase().contains(&q)
            })
            .cloned()
            .collect()
    }
}
