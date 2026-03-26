# Calorie Canvas

## Runtime Modes

This app supports two modes controlled entirely by environment variables.

### Supabase + Vercel

Set:

```env
REACT_APP_AUTH_MODE=supabase
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key
```

In this mode:
- auth uses Supabase
- profile data uses Supabase
- catalog/meals/logs use Supabase
- no Rust backend is required

### Local Rust Backend

Set:

```env
REACT_APP_AUTH_MODE=local
REACT_APP_API_BASE_URL=http://127.0.0.1:3001/api
```

In this mode:
- auth/catalog can use the Rust backend
- local seeded ingredients are available
- browser-storage fallbacks remain available where implemented

## Vercel Deployment

The repo includes `vercel.json` with a rewrite to `index.html`, so React Router routes work on refresh and direct links.

### Required Vercel Environment Variables

```env
REACT_APP_AUTH_MODE=supabase
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Local Development

```bash
npm start
```

For local Rust backend mode, also run the backend server separately and point `REACT_APP_API_BASE_URL` at it.

## Build

```bash
npm run build
```
