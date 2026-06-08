# Commit — Environment Variables

## Backend (`backend/`)

All backend environment variables are required and loaded in `backend/config/config.go`. The server will fail to start if any are missing.

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `DB_HOST` | PostgreSQL host address | `localhost` |
| `DB_PORT` | PostgreSQL port (numeric) | `5432` |
| `DB_USER` | PostgreSQL user | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | `postgres` |
| `DB_NAME` | PostgreSQL database name | `commit` |
| `JWT_SECRET` | HMAC-SHA256 key for signing JWT tokens | `your-secret-here` |
| `PORT` | HTTP server listen port (numeric) | `8080` |
| `APP_ENV` | Application environment; sets Gin to release mode when `production` | `development` |
| `RESEND_API_KEY` | Resend API key for email delivery | `re_123456...` |
| `EMAIL_FROM` | From-address for outgoing emails | `noreply@example.com` |

The backend does **not** use a `.env` file loader (no godotenv). Environment variables must be set in the shell or via your process manager.

## Frontend (`frontend/apps/app/` and `frontend/apps/web/`)

Frontend variables are declared in `vite-env.d.ts` and accessed via `import.meta.env`. They must be prefixed with `VITE_` to be exposed by Vite.

| Variable | Description | Example Value | Used By |
|----------|-------------|---------------|---------|
| `VITE_API_URL` | Backend API base URL (used as Axios `baseURL`) | `http://localhost:8080` | app, web |
| `VITE_APP_URL` | Frontend application URL (for redirects) | `http://localhost:5173` | app, web |
| `VITE_DEV` | Built-in Vite flag; used for debug logging in dev mode | — | app, web |

## Usage

Copy the appropriate `.env.example` file to `.env` in each directory and fill in the values:

```bash
# Root (if you use a combined env)
cp .env.example .env

# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env
```

> **Note:** The backend reads directly from the environment, not from a `.env` file. If you want to use a `.env` file for local development, source it manually or use a tool like `direnv`.

## Password Reset & Email Setup

The password reset flow uses [Resend](https://resend.com) to deliver reset links. Configuration is optional — if `RESEND_API_KEY` is empty, the backend falls back to logging reset links to stdout (useful for development).

### Quick Start (Development)

No Resend config needed. Reset links are logged to the backend console:
```
[EMAIL] To: user@example.com | Reset link: http://localhost:5173/reset-password?token=abc123
```

### Production (Resend)

1. Sign up at [resend.com](https://resend.com) and verify a domain
2. Create an API key in the Resend dashboard
3. Set these environment variables:

```
RESEND_API_KEY=re_123456789...
EMAIL_FROM=noreply@your-domain.com
VITE_APP_URL=https://your-frontend.com
```

### Security Notes (same for any email provider)

- Tokens are SHA-256 hashed before storage — the raw token is never persisted
- Tokens expire after 1 hour
- Tokens are single-use (consumed on first successful reset)
- Resetting a password revokes all existing refresh tokens for that user
- The forgot-password endpoint is rate-limited to 3 requests per minute per IP
- The endpoint returns a generic message regardless of whether the email exists (prevents user enumeration)
