# Environment Variables

## Backend (`backend/`)

All backend variables are loaded in `backend/config/config.go`. The server fails to start if any required variable is missing.

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DB_HOST` | yes | PostgreSQL host address | `localhost` |
| `DB_PORT` | yes | PostgreSQL port (numeric) | `5432` |
| `DB_USER` | yes | PostgreSQL user | `postgres` |
| `DB_PASSWORD` | yes | PostgreSQL password | `postgres` |
| `DB_NAME` | yes | PostgreSQL database name | `commit` |
| `JWT_SECRET` | yes | HMAC-SHA256 key for signing JWT tokens | `your-secret-here` |
| `PORT` | yes | HTTP server listen port (numeric) | `8080` |
| `APP_ENV` | yes | Sets Gin to release mode when `production` | `development` |
| `FOCUS_DAILY_MINIMUM_MINUTES` | no | Auto-log "Focused study" habit when daily focus >= this (default: `120`) | `120` |
| `LOGIN_RATE_LIMIT` | no | Login attempts allowed per IP per minute (default: `5`). For load testing, override imperatively on the deployment — do **not** raise this in committed config. | `5` |
| `RESEND_API_KEY` | no | Resend API key for email delivery (falls back to logging to stdout) | `re_123456...` |
| `EMAIL_FROM` | no | From-address for outgoing emails | `noreply@example.com` |
| `VITE_WEB_URL` | no | Frontend URL for password reset links in emails | `http://localhost:5173` |
| `ALLOWED_ORIGINS` | no | Comma-separated CORS origins (required in production, defaults to empty in dev) | `http://localhost:5173,http://localhost:5174` |
| `COOKIE_DOMAIN` | no | Domain attribute for auth cookies (set to `.yourdomain.com` for cross-subdomain auth) | `.rahulkoju.com.np` |
| `JWT_EXPIRY_HOURS` | no | Refresh token expiry in hours (default: `168` = 7 days) | `168` |
| `JWT_EXPIRY_MINUTES` | no | Access token expiry in minutes (default: `1440` = 24 hours) | `1440` |
| `DB_MAX_CONNS` | no | Max database connections in pool (default: `10`) | `10` |
| `DB_MIN_CONNS` | no | Min database connections in pool (default: `1`) | `1` |
| `DB_MAX_CONN_LIFETIME_MINUTES` | no | Max connection lifetime before recycling (default: `60`) | `60` |
| `DB_MAX_CONN_IDLE_MINUTES` | no | Max connection idle time before closing (default: `30`) | `30` |

The backend does **not** load `.env` files automatically. Environment variables must be set in the shell or via your process manager.

## Frontend (`frontend/`)

Frontend variables are declared in `vite-env.d.ts` and accessed via `import.meta.env`. They must be prefixed with `VITE_` to be exposed by Vite.

| Variable | Required | Description | Example | Used By |
|----------|----------|-------------|---------|---------|
| `VITE_API_URL` | yes | Backend API base URL (used as Axios `baseURL`) | `http://localhost:8080` | app, web |
| `VITE_APP_URL` | no | Frontend app URL (for redirects) | `http://localhost:5174` | app, web |
| `VITE_DEV` | no | Built-in Vite flag — used for debug logging | — | app, web |

## Reference Files

For the canonical production configuration, see:
- **ConfigMap:** `infra/k8s/config/configmap.yaml` (non-sensitive production values)
- **Secret template:** `infra/k8s/config/secret.yaml.example` (sensitive value structure)

## Setup

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env
```

## Password Reset & Email

The password reset flow uses [Resend](https://resend.com). Configuration is optional — if `RESEND_API_KEY` is not set, the backend logs reset links to stdout:

```
[EMAIL] To: user@example.com | Reset link: http://localhost:5173/reset-password?token=abc123
```

### Production Setup

```bash
RESEND_API_KEY=re_123456789...
EMAIL_FROM=noreply@your-domain.com
VITE_WEB_URL=https://your-frontend.com
```

### Security Notes

- Reset tokens are SHA-256 hashed before storage — the raw token is never persisted
- Tokens expire after 1 hour
- Tokens are single-use (consumed on first successful reset)
- Resetting a password revokes all existing refresh tokens for that user
- Forgot-password endpoint is rate-limited to 3 requests per minute per IP
- Returns a generic message regardless of whether the email exists (prevents user enumeration)
