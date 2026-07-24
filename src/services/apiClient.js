import { API_BASE_URL } from '../config/api';

let csrfToken = null;

export function clearCsrfToken() {
  csrfToken = null;
}

export function getCsrfToken() {
  return csrfToken;
}

export function setCsrfToken(token) {
  csrfToken = token || null;
}

export async function apiRequest(path, { body, csrf = false, method = 'GET' } = {}) {
  if (csrf && !csrfToken) {
    const sessionResult = await apiRequest('/auth/session');
    if (sessionResult.error) return sessionResult;
  }

  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (csrf && csrfToken) headers['X-CSRF-Token'] = csrfToken;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { payload: null, error: { message: 'Application service is unavailable.' } };
  }

  let payload = null;
  if (response.status !== 204) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  }
  if (payload?.csrfToken) setCsrfToken(payload.csrfToken);
  if (!response.ok) {
    if (response.status === 401) clearCsrfToken();
    return {
      payload,
      error: { message: payload?.error || 'Application request failed.', status: response.status },
    };
  }
  return { payload, error: null };
}
