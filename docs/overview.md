# Commit — Overview

Commit is a personal productivity and learning tracker designed for individuals who want to manage tasks, build habits, take notes, track learning, run focus sessions, and reflect with periodic reviews — all in one place. It combines a Go backend with a React frontend in a pnpm monorepo.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript 6, Vite 8, Tailwind CSS 4, shadcn/ui, TanStack Query 5, Zustand 5, React Router 7, Axios, React Hook Form + Zod, Tiptap, Recharts |
| **Backend** | Go 1.25, Gin 1.10, pgx 5, JWT (golang-jwt/v5), bcrypt |
| **Database** | PostgreSQL (with pgcrypto extension) |
| **Monorepo** | pnpm 10, Turbo 2 |
| **Auth** | Cookie-based JWT (HttpOnly `commit_token` cookie) |

## Monorepo Structure

```
commit/
├── backend/                # Go API server
│   ├── main.go             # Entry point — config, DB, migrations, routes, server
│   ├── migrations.go       # Embedded SQL migrations (embed.FS)
│   ├── config/config.go    # Environment variable loading
│   ├── db/                 # Database connection (pgxpool) + migration runner
│   ├── migrations/         # SQL migration files (001–009)
│   ├── handlers/           # HTTP handlers (request parsing, response writing)
│   ├── services/           # Business logic layer
│   ├── models/             # Data access layer (raw SQL via pgx)
│   ├── middleware/         # Auth, RBAC, CORS, Logger
│   └── routes/routes.go    # All route definitions
├── frontend/
│   ├── apps/
│   │   ├── app/            # Main SPA (Vite + React 19)
│   │   │   └── src/        # Pages, components, hooks, stores, types, lib
│   │   └── web/            # Marketing / auth site (Vite + React 19)
│   │       └── src/        # Pages (Home, Login, Signup), components, lib
│   └── packages/
│       └── ui/             # Shared shadcn/ui component library
├── docs/                   # Project documentation
└── .env.example            # Environment variable template
```

## Startup Sequence

1. **Backend**: `main.go` loads `Config` from environment variables, connects to PostgreSQL via `pgxpool`, runs embedded SQL migrations (001–009), wires models → services → handlers, registers Gin routes, and starts the HTTP server on the configured `PORT`.
2. **Frontend (app)**: Vite dev server serves the main SPA at a local port. The app fetches data from the backend using Axios with `VITE_API_URL` as the base URL.
3. **Frontend (web)**: Vite dev server serves the marketing/auth site. Users authenticate via Login/Signup forms; the backend sets an HttpOnly JWT cookie (`commit_token`) that the SPA uses for authenticated requests.

All API routes are prefixed with `/api/v1`. Protected routes require the `commit_token` cookie. Admin routes additionally require the `admin` role.
