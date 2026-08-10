const isLocalDevelopment =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

function resolveApiBaseUrl(value = process.env.REACT_APP_API_BASE_URL) {
  const localApiUrl = typeof window !== 'undefined'
    ? `http://${window.location.hostname}:3001/api`
    : 'http://127.0.0.1:3001/api';
  const candidate = String(value || (isLocalDevelopment ? localApiUrl : '/api')).trim();
  if (!candidate) throw new Error('The Express API base URL is required.');
  if (candidate.startsWith('/')) return candidate.replace(/\/$/, '');
  let parsed;
  try { parsed = new URL(candidate); } catch { throw new Error('REACT_APP_API_BASE_URL must be an HTTP(S) URL or root-relative path.'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('REACT_APP_API_BASE_URL must use HTTP or HTTPS.');
  }
  return candidate.replace(/\/$/, '');
}

export const API_BASE_URL = resolveApiBaseUrl();
export { resolveApiBaseUrl };
