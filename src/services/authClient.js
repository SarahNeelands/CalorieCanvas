import { apiRequest, clearCsrfToken, getCsrfToken } from './apiClient';

const LOCAL_USER_ID_KEY = 'user_id';

async function expressRequest(path, { body, csrf = false, method = 'GET' } = {}) {
  return apiRequest(`/auth${path}`, { body, csrf, method });
}

function notifyAuthChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('cc-auth-changed'));
}

function replaceStoredSessionUser(userId, { notify = true, forceNotify = false } = {}) {
  if (!userId) return;
  const previous = localStorage.getItem(LOCAL_USER_ID_KEY);
  localStorage.setItem(LOCAL_USER_ID_KEY, userId);
  if (notify && (forceNotify || previous !== userId)) notifyAuthChange();
}

export function setStoredUserId(userId) {
  replaceStoredSessionUser(userId);
}

export function getStoredUserId() {
  return localStorage.getItem(LOCAL_USER_ID_KEY);
}

export function clearStoredUserId(notify = true) {
  const existed = localStorage.getItem(LOCAL_USER_ID_KEY) !== null;
  localStorage.removeItem(LOCAL_USER_ID_KEY);
  if (notify && existed) notifyAuthChange();
}

function clearInvalidSession({ notify = false } = {}) {
  clearCsrfToken();
  clearStoredUserId(notify);
}

async function getExpressSession() {
  const result = await expressRequest('/session');
  const session = result.error ? null : result.payload?.session || null;
  const userId = session?.user?.id || null;
  if (userId) replaceStoredSessionUser(userId, { notify: false });
  else clearInvalidSession();
  return { session, error: result.error };
}

export async function signUp({ email, password }) {
  const result = await expressRequest('/signup', { method: 'POST', body: { email, password } });
  if (result.error) return { data: null, error: result.error };
  const payload = result.payload?.data
    ? { data: result.payload.data, error: null }
    : { data: { user: null, session: null }, error: null };
  const userId = payload.data?.user?.id;
  if (payload.data?.session && userId) replaceStoredSessionUser(userId);
  return payload;
}

export async function signIn({ email, password }) {
  const result = await expressRequest('/login', { method: 'POST', body: { email, password } });
  if (result.error) {
    clearInvalidSession();
    return { data: null, error: result.error };
  }
  const userId = result.payload?.data?.user?.id;
  if (!userId || !result.payload?.data?.session) {
    clearInvalidSession();
    return { data: null, error: { message: 'Unable to establish an authenticated session.' } };
  }
  replaceStoredSessionUser(userId, { forceNotify: true });
  return result.payload;
}

export async function getCurrentUserId() {
  const { session } = await getExpressSession();
  return session?.user?.id || null;
}

export async function getCurrentSession() {
  const { session } = await getExpressSession();
  return { session };
}

export async function validateStoredSession() {
  const { session } = await getExpressSession();
  return Boolean(session?.user?.id);
}

export async function signOutCurrentUser() {
  if (!getCsrfToken()) await getExpressSession();
  const result = await expressRequest('/logout', { method: 'POST', csrf: true });
  clearInvalidSession({ notify: true });
  if (result.error && result.error.status !== 401 && result.error.status !== 403) {
    throw new Error(result.error.message);
  }
}

export async function requestPasswordReset(email) {
  const result = await expressRequest('/forgot-password', { method: 'POST', body: { email } });
  return { data: result.error ? null : {}, error: result.error };
}

export async function resetPassword({ token, password }) {
  const result = await expressRequest('/reset-password', { method: 'POST', body: { token, password } });
  if (result.error) return { data: null, error: result.error };
  const userId = result.payload?.data?.user?.id;
  if (result.payload?.data?.session && userId) replaceStoredSessionUser(userId);
  else clearInvalidSession();
  return result.payload;
}

export async function verifyEmail(token) {
  const result = await expressRequest('/verify-email', { method: 'POST', body: { token } });
  if (result.error) return { data: null, error: result.error };
  const userId = result.payload?.data?.user?.id;
  if (result.payload?.data?.session && userId) replaceStoredSessionUser(userId);
  else clearInvalidSession();
  return result.payload;
}

export async function resendVerification(email) {
  const result = await expressRequest('/resend-verification', { method: 'POST', body: { email } });
  return { data: result.error ? null : {}, error: result.error };
}

export async function changePassword({ currentPassword, newPassword }) {
  if (!getCsrfToken()) await getExpressSession();
  const result = await expressRequest('/change-password', {
    method: 'POST', csrf: true, body: { currentPassword, newPassword },
  });
  return result.error ? { data: null, error: result.error } : result.payload;
}
