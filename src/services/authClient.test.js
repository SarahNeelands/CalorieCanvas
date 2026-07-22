jest.mock('../config/api', () => ({ API_BASE_URL: 'http://api.test/api' }));

import {
  getCurrentSession,
  getStoredUserId,
  requestPasswordReset,
  signIn,
  signOutCurrentUser,
  signUp,
} from './authClient';
import { apiRequest } from './apiClient';

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn();
});

afterEach(() => {
  delete global.fetch;
});

test('Express sign-in and session calls preserve the existing public response shape', async () => {
  global.fetch
    .mockResolvedValueOnce(response(200, {
      data: {
        user: { id: 'user-1', email: 'user@example.com' },
        session: { user: { id: 'user-1', email: 'user@example.com' } },
      },
      error: null,
      csrfToken: 'csrf-one',
    }))
    .mockResolvedValueOnce(response(200, {
      session: { user: { id: 'user-1', email: 'user@example.com' } },
      csrfToken: 'csrf-one',
    }))
    .mockResolvedValueOnce(response(200, { data: { display_name: 'User' }, error: null }));

  const login = await signIn({ email: 'user@example.com', password: 'password' });
  expect(login.error).toBeNull();
  expect(login.data.user.id).toBe('user-1');
  expect(getStoredUserId()).toBe('user-1');
  expect(global.fetch.mock.calls[0][1].credentials).toBe('include');

  const session = await getCurrentSession();
  expect(session.session.user.email).toBe('user@example.com');

  await apiRequest('/profile', { method: 'PUT', csrf: true, body: { display_name: 'User' } });
  expect(global.fetch.mock.calls[2][1].headers['X-CSRF-Token']).toBe('csrf-one');
  expect(document.cookie).not.toContain('cc_csrf');
});

test('signup and password reset requests keep data/error return values', async () => {
  global.fetch
    .mockResolvedValueOnce(response(202, { message: 'accepted' }))
    .mockResolvedValueOnce(response(202, { message: 'accepted' }));

  await expect(signUp({ email: 'new@example.com', password: 'password' })).resolves.toEqual({
    data: { user: null, session: null },
    error: null,
  });
  await expect(requestPasswordReset('new@example.com')).resolves.toEqual({ data: {}, error: null });
});

test('logout sends the session CSRF token and clears the stored user', async () => {
  global.fetch
    .mockResolvedValueOnce(response(200, {
      data: {
        user: { id: 'user-1', email: 'user@example.com' },
        session: { user: { id: 'user-1', email: 'user@example.com' } },
      },
      error: null,
      csrfToken: 'csrf-logout',
    }))
    .mockResolvedValueOnce({ ok: true, status: 204 });

  await signIn({ email: 'user@example.com', password: 'password' });
  await signOutCurrentUser();
  const logoutRequest = global.fetch.mock.calls[1][1];
  expect(logoutRequest.headers['X-CSRF-Token']).toBe('csrf-logout');
  expect(getStoredUserId()).toBeNull();
});
