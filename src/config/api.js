import { IS_LOCAL_DEV } from './runtime';

const defaultApiBaseUrl = IS_LOCAL_DEV ? 'http://127.0.0.1:3001/api' : '/api';

export const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || defaultApiBaseUrl).replace(/\/$/, '');
