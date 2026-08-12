# ColdMovie

ColdMovie is an Angular movie catalog backed by a real Node/Express API. The frontend no longer exposes the TMDB token; TMDB calls go through the backend proxy.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and add your TMDB Read Access Token:

```bash
copy .env.example .env
```

3. Run the API and Angular app together:

```bash
npm run dev
```

Or run them separately:

```bash
npm run api
npm start
```

Frontend: `http://localhost:4200`  
API: `http://localhost:3000/api/health`

## Backend Endpoints

- `GET /api/health`
- `GET /api/tmdb/*` - TMDB proxy with the server-side token
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/me/collections`
- `PUT /api/me/collections/:type`
- `GET /api/reviews/:mediaKey`
- `POST /api/reviews/:mediaKey`

## Production Notes

- Keep `.env` private. Never ship TMDB or JWT secrets in Angular files.
- Set `DATABASE_URL` to a PostgreSQL connection string for real multi-user production. Without it, the API falls back to local `server/data/db.json`, which is not persistent on serverless hosts.
- Text recommendations are handled by the Angular app from live TMDB catalog signals.

## Vercel Deployment

Deploy the backend and frontend as two separate Vercel projects.

### Backend project

Use the `server` folder as the Vercel project root.

Environment variables:

```bash
CLIENT_ORIGIN=https://your-frontend-project.vercel.app
TMDB_READ_TOKEN=your_tmdb_read_access_token_here
JWT_SECRET=replace-with-a-long-random-secret
DATABASE_URL=postgres://user:password@host:5432/database
```

On first boot with `DATABASE_URL`, the API creates a `coldmovie_state` table and seeds it from `server/data/db.json` if the database is empty.

After deployment, check:

```bash
https://your-backend-project.vercel.app/api/health
```

### Frontend project

Use the repository root as the Vercel project root.

Environment variables:

```bash
FRONTEND_API_BASE_URL=https://your-backend-project.vercel.app
```

Vercel build settings:

```bash
Build Command: npm run build
Output Directory: dist/cineverse/browser
```

Local development still uses `/api` through `proxy.conf.json`; production requests are rewritten by the Angular interceptor to `FRONTEND_API_BASE_URL`.

## Build

```bash
npm run build
```
