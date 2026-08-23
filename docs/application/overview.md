# Commit — Overview

Commit is a personal productivity tracker for managing tasks, building habits, taking notes with attached reminders, and running persistent focus sessions — all in one integrated application.

## Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Task Management** | Full CRUD with priority (low/medium/high), status (todo/in-progress/done), scheduling, recurrence (daily/weekdays/weekly/monthly), and views (today/backlog/completed/all) |
| 2 | **Habit Tracking** | Boolean and numeric habits with comparison operators (`gte`/`lte`/`eq`/`between`) for at-least, at-most, exactly, and range targets, daily/weekly frequency, categories, a date×habit matrix view with drag-and-drop reordering, schedule-aware streaks, 30/90-day analytics, and CSV export |
| 3 | **Notes** | Rich-text notes with full-text search (PostgreSQL tsvector) and wiki-link backlinks (`[[Note Title]]`) |
| 4 | **Reminders** | One-time and cron-recurring reminders attached to notes, delivered via email (Resend) and browser notifications, with preset and raw-cron schedules |
| 5 | **Focus Sessions** | Persistent, resumable Pomodoro/stopwatch sessions linked to tasks — timer state survives refreshes and device switches; session history with filtering, stats, and auto-habit logging on completion when daily focus exceeds a threshold |
| 6 | **Dashboard** | Customizable widget layout with metric cards, habit/productivity charts, dual GitHub-style activity heatmaps (habit completions + overall activity, per calendar year with year switching), recent notes, and week-over-week trend comparisons |
| 7 | **Authentication** | Cookie-based JWT with access/refresh token rotation, bcrypt password hashing, forgot/reset password flow via Resend email, rate-limited endpoints |
| 8 | **Admin** | User listing and deletion for admin-role users |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend (app)** | React 19, TypeScript 6, Vite 8, Tailwind CSS 4, shadcn/ui |
| **Frontend (state)** | TanStack Query 5, Zustand 5 |
| **Frontend (routing)** | React Router 7 |
| **Frontend (http)** | Axios |
| **Frontend (forms)** | React Hook Form + Zod |
| **Frontend (editor)** | Tiptap (rich text) |
| **Frontend (charts)** | Recharts |
| **Backend** | Go 1.25, Gin 1.10, pgx 5 |
| **Auth** | golang-jwt/v5, bcrypt |
| **Database** | PostgreSQL 16+ (pgcrypto extension) |
| **Email** | Resend (optional, logs to stdout in dev) |
| **Monorepo** | pnpm 10, Turbo 2 |

## Monorepo Structure

```
commit/
├── backend/                    # Go API server
│   ├── main.go                 # Entry point — config, DB, migrations, routes, server
│   ├── migrations.go           # Embedded SQL migrations (embed.FS)
│   ├── config/config.go        # Environment variable loading
│   ├── db/                     # Database connection (pgxpool) + migration runner
│   ├── migrations/             # 027 SQL migration files
│   ├── handlers/               # HTTP handlers (10 files)
│   ├── services/               # Business logic layer (9 files)
│   ├── models/                 # Data access layer — raw SQL via pgx (12 files)
│   ├── middleware/             # Auth, RBAC, CORS, Logger, RateLimiter
│   └── routes/routes.go        # All route definitions
├── frontend/
│   ├── apps/
│   │   ├── app/                # Main authenticated SPA (Vite + React 19)
│   │   │   └── src/            # Pages, components, hooks, stores, types, lib
│   │   └── web/                # Marketing & auth site (Vite + React 19)
│   │       └── src/            # Pages (Home, Login, Signup, etc.), components, lib
│   └── packages/
│       └── ui/                 # Shared shadcn/ui component library
├── docs/                       # Project documentation
└── .env.example                # Combined environment template
```

## Architecture Overview

**Backend**: `main.go` loads config from environment variables, connects to PostgreSQL via pgxpool, runs embedded SQL migrations, initializes the model → service → handler layers, registers Gin routes with middleware, and starts the HTTP server. All API routes are prefixed with `/api/v1`.

**Frontend**: Two Vite React apps share a common UI component library. The `web` app handles authentication (login, signup, password reset). The `app` SPA provides all authenticated features. Both use Axios with cookie-based auth against the Go backend.

**Auth**: HttpOnly cookie (`commit_token`) carries a signed JWT. Short-lived access tokens are rotated via refresh tokens. Password reset tokens are SHA-256 hashed before storage.

See [Architecture](architecture.md) for details, [Getting Started](getting-started.md) to run locally.
