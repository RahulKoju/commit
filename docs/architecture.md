# Architecture

## Backend Startup Sequence

```
main.go
  ├── Load Config (config/config.go)
  │     └── Reads all env vars, validates required fields
  ├── Connect to PostgreSQL (db/db.go)
  │     └── pgxpool with configurable pool size, lifetime, idle timeout
  ├── Run Migrations (db/migrate.go)
  │     └── Reads embedded SQL files (migrations/*.sql), applies in order
  │     └── Tracks applied versions in schema_migrations table
  ├── Initialize Models (models/*.go)
  │     └── Each model receives *pgxpool, executes raw SQL queries
  ├── Initialize Services (services/*.go)
  │     └── Business logic layer, receives models + optional dependencies
  ├── Initialize Email Sender (services/email.go)
  │     └── ResendSender if RESEND_API_KEY set, else LogSender (stdout)
  ├── Initialize Auth Service
  │     └── Receives userModel, refreshTokenModel, passwordResetTokenModel,
  │         emailSender, appURL, habitService, JWT config
  ├── Create Gin Router
  │     └── Registers global middleware (Logger, Recovery, CORS)
  ├── Register Routes (routes/routes.go)
  │     └── Wires handlers → services → models with middleware
  └── Start HTTP Server
        └── Listens on configured PORT
```

## Middleware Pipeline

Requests pass through middleware in this order:

```
Request
  → Logger (gin.Logger — logs method, path, status, latency)
  → Recovery (gin.Recovery — catches panics, returns 500)
  → CORS (validates Origin header, sets Access-Control-* headers)
  → RateLimiter (per-IP, applied to auth endpoints: 3-5 req/min)
  → RequireAuth (reads commit_token cookie, parses JWT, sets userID + role in context)
  → RequireRole("admin") (checks role from context, admin-only endpoints)
  → Handler
```

### Middleware Details

| Middleware | File | Behavior |
|-----------|------|----------|
| **Logger** | `middleware/logger.go` | Standard Gin request logging |
| **CORS** | `middleware/cors.go` | Validates `Origin` against allowed list; handles OPTIONS preflight |
| **RateLimiter** | `middleware/ratelimit.go` | Token-bucket per IP using `x/time/rate`; periodic stale-entry cleanup |
| **RequireAuth** | `middleware/auth.go` | Reads `access_token` cookie; parses JWT with `golang-jwt`; injects `userID` (UUID) and `role` (string) into `gin.Context` |
| **RequireRole** | `middleware/rbac.go` | Reads `role` from context; rejects non-matching roles with `403 Forbidden` |

## Auth Flow

### Registration
```
POST /api/v1/auth/register
  → bcrypt hash password
  → Insert user
  → Seed 8 default habits across 3 categories
  → Generate access_token (15 min) + refresh_token (7 days)
  → Set commit_token cookie (access_token)
  → Set refresh_token cookie
  → Return user object
```

### Login
```
POST /api/v1/auth/login
  → Lookup user by email
  → bcrypt compare password
  → Generate access_token + refresh_token
  → Set cookies
  → Return user object
```

### Token Refresh
```
POST /api/v1/auth/refresh
  → Read refresh_token cookie
  → Hash token, look up in refresh_tokens table
  → Verify not expired
  → Rotate: revoke old, issue new access_token + refresh_token
  → Update cookies
```

### Logout
```
POST /api/v1/auth/logout
  → Revoke refresh token(s) for user
  → Clear cookies
```

### Password Reset
```
POST /api/v1/auth/forgot-password
  → Rate-limited (3/min/IP)
  → Generate random token, hash with SHA-256, store in password_reset_tokens
  → Send email via Resend (or log to stdout if no API key)
  → Returns generic message (prevents user enumeration)

POST /api/v1/auth/reset-password
  → Look up SHA-256(token) in password_reset_tokens
  → Verify not expired (1 hour) and not used
  → Hash new password with bcrypt
  → Revoke all refresh tokens for user
  → Mark reset token as used
```

## Common Patterns

### Pagination

All list endpoints support pagination via query parameters:

| Param | Default | Max | Description |
|-------|---------|-----|-------------|
| `limit` | 20 | 100 | Number of items per page |
| `offset` | 0 | — | Number of items to skip |

Response includes the array directly (no pagination metadata). Frontend can check array length < limit to determine last page.

### Error Response

Errors follow a consistent shape:

```json
{
  "error": "Human-readable message"
}
```

HTTP status codes:
| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | Deleted (no body) |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient role) |
| 404 | Resource not found |
| 409 | Conflict (duplicate name, etc.) |
| 429 | Rate limited |
| 500 | Internal server error |

### Recurrence

Tasks support automatic recurrence when marked `done`:

| Rule | Behavior |
|------|----------|
| `daily` | Next instance scheduled for tomorrow |
| `weekdays` | Next instance scheduled for next weekday |
| `weekly` | Next instance scheduled for same day next week |
| `monthly` | Next instance scheduled for same day next month |

When a task with a recurrence rule is updated to `status: "done"`, the server auto-creates the next occurrence and marks it as `todo`.

### Auto-Habit Logging

Creating a focus session can auto-log a "Focused study" habit if the user's total daily focus minutes meets or exceeds `FOCUS_DAILY_MINIMUM_MINUTES` (default: 120). This is checked server-side when a session is created.
