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
- Replace `server/data/db.json` with PostgreSQL/Supabase for real multi-user production.
- Text recommendations are handled by the Angular app from live TMDB catalog signals.

## Build

```bash
npm run build
```
