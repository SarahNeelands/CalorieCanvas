export const IS_LOCAL_DEV =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const rawAuthMode = String(process.env.REACT_APP_AUTH_MODE || '')
  .trim()
  .toLowerCase();

export const AUTH_MODE =
  rawAuthMode === 'local' || rawAuthMode === 'supabase'
    ? rawAuthMode
    : (IS_LOCAL_DEV ? 'local' : 'supabase');

export function isLocalAuth() {
  return AUTH_MODE === 'local';
}
