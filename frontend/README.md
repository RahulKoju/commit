# Commit — Frontend

Vite-based monorepo for the Commit productivity application.

## Structure

- `apps/app`: The main authenticated SPA (React 19 + Vite).
- `apps/web`: Marketing site, landing page, and authentication flows (React 19 + Vite).
- `packages/ui`: Shared UI components based on shadcn/ui.

## Tech Stack

- **Framework**: React 19 (using New Hooks & API)
- **Styling**: Tailwind CSS v4
- **State**: TanStack Query (Server State) & Zustand (Client State)
- **Routing**: React Router v7
- **UI Components**: shadcn/ui

## Common Commands

Run these from the root of the `frontend` directory:

```bash
# Install all dependencies
pnpm install

# Start both apps in dev mode (Turbo)
pnpm dev

# Build both apps for production
pnpm build

# Typecheck and lint
pnpm typecheck
pnpm lint
```

## Adding UI Components

To add a new shadcn component to the shared package:

```bash
pnpm dlx shadcn@latest add <component-name> -c apps/web
```

Components are moved automatically to `packages/ui/src/components` via the workspace configuration.
