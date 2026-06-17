# Commit — Backend

Go-based REST API for the Commit productivity application.

## Tech Stack

- **Language**: Go 1.25+
- **Framework**: [Gin Gonic](https://gin-gonic.com/) 1.10
- **Database**: PostgreSQL 16+ via [pgx v5](https://github.com/jackc/pgx)
- **Authentication**: JWT (HttpOnly cookies), bcrypt hashing
- **Migrations**: Embedded SQL files via `embed.FS`

## Project Structure

- `main.go`: Entry point — initializes config, database, and starts the server.
- `routes/`: Central route definitions and module grouping.
- `handlers/`: HTTP layer — request parsing, validation, and response formatting.
- `services/`: Business logic layer — orchestrates data between models.
- `models/`: Data access layer — raw SQL queries and DB interaction.
- `middleware/`: Auth, RBAC, logging, rate limiting, and CORS.
- `migrations/`: SQL migration files (schema definition, indexes, constraints).
- `config/`: Environment variable management.

## Development

### Running the server

Ensure you have a PostgreSQL database created. Set up your `.env` file from `.env.example`.

```bash
# Load environment variables
export $(grep -v '^#' .env | xargs)

# Run migrations and start server
go run .
```

The server runs on `http://localhost:8080`.

### Database Migrations

Migrations are run automatically on startup. They are located in the `migrations/` directory and tracked in the `schema_migrations` table.

## API Documentation

See the central [API Reference](../docs/application/api.md) for endpoint details.
