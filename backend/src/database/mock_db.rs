use crate::models::user::User;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct MockDB {
    pub users: Arc<Mutex<Vec<User>>>,
}

impl MockDB {
    pub fn new() -> Self {
        Self {
            users: Arc::new(Mutex::new(vec![])),
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
        return false
    }


}
