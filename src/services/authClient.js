import { supabase } from '../supabaseClient';
import { isLocalAuth } from '../config/runtime';

const LOCAL_AUTH_USERS_KEY = 'local_auth_users_v1';
const LOCAL_USER_ID_KEY = 'user_id';

function saveLocalUserId(userId) {
  localStorage.setItem(LOCAL_USER_ID_KEY, userId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('cc-auth-changed'));
  }
}

export function setStoredUserId(userId) {
  if (!userId) return;
  saveLocalUserId(userId);
}

export function getStoredUserId() {
  return localStorage.getItem(LOCAL_USER_ID_KEY);
}

export function clearStoredUserId() {
  localStorage.removeItem(LOCAL_USER_ID_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('cc-auth-changed'));
  }
}

function readLocalAuthUsers() {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalAuthUsers(users) {
  localStorage.setItem(LOCAL_AUTH_USERS_KEY, JSON.stringify(users));
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function createLocalUserId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local-user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function signUpLocalAuth(email, password) {
  const normalizedEmail = normalizeEmail(email);
  const users = readLocalAuthUsers();

  if (!normalizedEmail || !password) {
    return { data: null, error: { message: 'Email and password are required.' } };
  }

  if (users.some((user) => user.email === normalizedEmail)) {
    return { data: null, error: { message: 'An account with this email already exists.' } };
  }

  const user = {
    id: createLocalUserId(),
    email: normalizedEmail,
    password,
    created_at: new Date().toISOString(),
  };

  users.push(user);
  writeLocalAuthUsers(users);
  saveLocalUserId(user.id);

  return {
    data: { user: { id: user.id, email: user.email }, session: { local: true } },
    error: null,
  };
}

function signInLocalAuth(email, password) {
  const normalizedEmail = normalizeEmail(email);
  const user = readLocalAuthUsers().find(
    (candidate) => candidate.email === normalizedEmail && candidate.password === password
  );

  if (!user) {
    return { data: null, error: { message: 'Invalid email or password.' } };
  }

  saveLocalUserId(user.id);
  return {
    data: { user: { id: user.id, email: user.email }, session: { local: true } },
    error: null,
  };
}

function getLocalAuthUserById(userId) {
  if (!userId) return null;
  return readLocalAuthUsers().find((user) => user.id === userId) || null;
}

export async function signUp({ email, password, emailRedirectTo }) {
  if (isLocalAuth()) {
    return signUpLocalAuth(email, password);
  }

  return supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });
}

export async function signIn({ email, password }) {
  if (isLocalAuth()) {
    return signInLocalAuth(email, password);
  }

  const result = await supabase.auth.signInWithPassword({ email, password });
  const userId = result?.data?.user?.id || result?.data?.session?.user?.id;
  if (userId) {
    saveLocalUserId(userId);
  }
  return result;
}

export async function getCurrentUserId() {
  if (isLocalAuth()) {
    return getStoredUserId();
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id) {
    saveLocalUserId(user.id);
  }
  return user?.id || null;
}

export async function getCurrentSession() {
  if (isLocalAuth()) {
    const userId = getStoredUserId();
    const user = getLocalAuthUserById(userId);
    return { session: user ? { user: { id: user.id, email: user.email }, local: true } : null };
  }

  const { data: { session } } = await supabase.auth.getSession();
  return { session };
}

export async function validateStoredSession() {
  if (isLocalAuth()) {
    const userId = getStoredUserId();
    if (!userId) return false;

    const user = getLocalAuthUserById(userId);
    if (!user) {
      clearStoredUserId();
      return false;
    }

    return true;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    clearStoredUserId();
    return false;
  }

  if (session.user?.id) {
    saveLocalUserId(session.user.id);
  }

  return true;
}

export async function signOutCurrentUser() {
  clearStoredUserId();

  if (!isLocalAuth()) {
    await supabase.auth.signOut();
  }
}
