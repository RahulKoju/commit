# Getting Started

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Go | 1.25+ | `go version` |
| Node.js | 22+ | `node --version` |
| pnpm | 10+ | `pnpm --version` |
| PostgreSQL | 16+ | `psql --version`; requires `pgcrypto` extension |

## Clone & Setup

```bash
git clone <repo-url>
cd commit
```

## Backend

### 1. Create the database

```bash
createdb commit
# or via psql:
psql -c "CREATE DATABASE commit;"
```

### 2. Configure environment variables

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your database credentials. Required values:

| Variable | Description |
|----------|-------------|
| `DB_HOST` | Database host (default: `localhost`) |
| `DB_PORT` | Database port (default: `5432`) |
| `DB_USER` | Database user |
| `DB_PASSWORD` | Database password |
| `DB_NAME` | Database name (default: `commit`) |
| `JWT_SECRET` | HMAC-SHA256 key for signing tokens |
| `PORT` | Server listen port (default: `8080`) |

> The backend does **not** load `.env` files automatically. You must export the variables or use a tool like `direnv`.

### 3. Start the server

```bash
cd backend
export $(grep -v '^#' ../backend/.env | xargs)
go run .
```

The server will:
1. Connect to PostgreSQL
2. Run all pending migrations automatically (tables, indexes, extensions)
3. Start on `http://localhost:8080`

Verify: `curl http://localhost:8080/healthz` returns `{"status":"ok","version":"1.0.0"}`

## Frontend

### 1. Install dependencies

```bash
cd frontend
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# or per-app:
cp apps/web/.env.example apps/web/.env
cp apps/app/.env.example apps/app/.env
```

Required:
- `VITE_API_URL` — backend URL (default: `http://localhost:8080`)

### 3. Start development servers

```bash
pnpm dev
```

This starts both apps via Turbo:

| App | URL | Purpose |
|-----|-----|---------|
| **web** | `http://localhost:5173` | Marketing site + Login/Signup |
| **app** | `http://localhost:5174` | Main authenticated application |

## Verify

1. Open `http://localhost:5173` — you should see the landing page
2. Click **Sign Up** and create an account
3. You'll be redirected to `http://localhost:5174/dashboard` with seeded default habits
4. Start creating tasks, logging habits, taking notes, and tracking your learning

## Troubleshooting

| Problem | Likely Cause | Solution |
|---------|-------------|----------|
| Backend fails to start | Missing env vars | Ensure `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET` are set |
| `pq: role "postgres" does not exist` | Wrong DB user | Check `DB_USER` matches your PostgreSQL user |
| `database "commit" does not exist` | DB not created | Run `createdb commit` |
| Frontend can't reach backend | Wrong `VITE_API_URL` | Ensure it points to the backend port (default `http://localhost:8080`) |
| CORS errors | Backend origin not allowed | Set `APP_ENV` to `development` or configure allowed origins in `middleware/cors.go` |
| Login returns 401 | Server not running or wrong URL | Check backend is running and `VITE_API_URL` is correct |
| Migrations fail | DB user lacks permissions | Grant `CREATE` on the database to the user |
