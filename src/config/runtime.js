export const IS_LOCAL_DEV =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const AUTH_MODE = process.env.REACT_APP_AUTH_MODE || (IS_LOCAL_DEV ? 'local' : 'supabase');

export function isLocalAuth() {
  return AUTH_MODE === 'local';
}
