# Commit

Track your tasks, habits, learning, focus, and reflections — all in one place.

Commit is a full-stack personal productivity application that helps you manage your daily workflow through task management, habit tracking, note taking, learning logging, focus session timers, and periodic self-reviews. Built with a Go backend and a React frontend, it runs as a pnpm monorepo with a shared component library.

## Tech Stack

| Layer        | Technology                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Frontend** | React 19, TypeScript 6, Vite 8, Tailwind CSS 4, shadcn/ui, TanStack Query 5, Zustand 5, React Router 7, Axios, React Hook Form + Zod, Tiptap, Recharts |
| **Backend**  | Go 1.25, Gin 1.10, pgx 5, JWT (golang-jwt/v5), bcrypt                                                                                                  |
| **Database** | PostgreSQL (pgcrypto extension)                                                                                                                        |

## Quick Start

### Prerequisites

- Go 1.25+
- Node.js 22+
- pnpm 10+
- PostgreSQL 16+

### Setup

1. **Clone the repository**

   ```bash
   git clone <repo-url>
   cd commit
   ```

2. **Set up environment variables**

   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

   Edit the `.env` files with your database credentials and secrets.

3. **Run the backend**

   ```bash
   cd backend
   source ../.env  # or export variables manually
   go run .
   ```

   The server starts on `http://localhost:8080` and runs database migrations automatically.

4. **Run the frontend**

   ```bash
   cd frontend
   pnpm install
   pnpm dev
   ```

   The main SPA starts at `http://localhost:5173` and the marketing site at `http://localhost:5174`.

5. **Open in browser**

   Navigate to `http://localhost:5173`, create an account, and start using Commit.

## Documentation

- [Overview](docs/overview.md) — app description, tech stack, monorepo structure, startup sequence
- [API Reference](docs/api.md) — all endpoints with methods, paths, auth requirements, request/response shapes
- [Database Schema](docs/database.md) — every table, column types, relationships, pulled from migration files
- [Environment Variables](docs/environment.md) — every env var, what it does, example values, which service uses it

## Environment Variables

See [Environment Variables](docs/environment.md) for full documentation and `.env.example` files at the repo root, `backend/`, and `frontend/` for placeholder templates.
