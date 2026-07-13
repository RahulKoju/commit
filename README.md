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
    export $(grep -v '^#' backend/.env | xargs)
    go run .
    ```

    The server starts on `http://localhost:8080` and runs database migrations automatically.

4. **Run the frontend**

   ```bash
   cd frontend
   pnpm install
   pnpm dev
   ```

    The marketing site (web) starts at `http://localhost:5173` and the main SPA (app) at `http://localhost:5174`.

5. **Open in browser**

   Navigate to `http://localhost:5173`, create an account, and start using Commit.

## Documentation

### Application Docs

| Doc | Contents |
|-----|----------|
| [Overview](docs/application/overview.md) | App description, 10 features, tech stack, monorepo structure |
| [Getting Started](docs/application/getting-started.md) | Prerequisites, setup, running locally, troubleshooting |
| [Architecture](docs/application/architecture.md) | Backend startup, middleware pipeline, auth flow, common patterns |
| [API Reference](docs/application/api.md) | All 50+ endpoints across 10 modules with request/response shapes |
| [Database Schema](docs/application/database.md) | All 18 tables, columns, indexes, constraints, relationships |
| [Environment Variables](docs/application/environment.md) | Backend and frontend env vars, defaults, examples |
| [Frontend](docs/application/frontend.md) | Monorepo layout, routing, state management, UI system, shortcuts |

### Infrastructure & Operations Docs

| Doc | Contents |
|-----|----------|
| [Infrastructure](docs/operations/infrastructure.md) | AWS, K8s cluster, network flow, Dockerfiles, component responsibilities |
| [Deployment](docs/operations/deployment.md) | Step-by-step provisioning and deployment from scratch |
| [CI/CD & GitOps](docs/operations/cicd.md) | GitHub Actions pipeline, Trivy vulnerability scanning, and ArgoCD GitOps workflow |
| [Observability](docs/operations/observability.md) | Monitoring, logging, alerting (Prometheus, Grafana, Loki) |
| [Runbook](docs/operations/runbook.md) | Operational procedures, troubleshooting, common fixes |

## Environment Variables

See [Environment Variables](docs/application/environment.md) for full documentation and `.env.example` files at the repo root, `backend/`, and `frontend/` for placeholder templates.
