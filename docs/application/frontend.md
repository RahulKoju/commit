# Frontend

## Monorepo Layout

```
frontend/
├── apps/
│   ├── web/                # Marketing & authentication site
│   │   └── src/
│   │       ├── App.tsx      # Router setup
│   │       ├── pages/       # HomePage, LoginPage, SignupPage, ForgotPasswordPage, ResetPasswordPage
│   │       ├── components/  # AuthLayout, UI components
│   │       └── lib/         # apiFetch utility
│   └── app/                # Main authenticated SPA
│       └── src/
│           ├── App.tsx      # Router setup (protected routes)
│           ├── pages/       # DashboardPage, FocusPage, TasksPage, HabitsPage, NotesPage, etc.
│           ├── components/  # AppShell, Sidebar, TopBar, feature-specific components
│           ├── hooks/       # TanStack Query hooks (per feature)
│           ├── store/       # Zustand stores (focus, UI, auth)
│           ├── types/       # TypeScript interfaces
│           └── lib/         # apiFetch, utils
└── packages/
    └── ui/                 # Shared shadcn/ui components
        └── src/
            └── components/ # Button, Card, Dialog, Input, etc.
```

## Application Routing

### web app (port 5173) — Public-facing

| Route | Page | Description |
|-------|------|-------------|
| `/` | `HomePage` | Landing page with hero, features, CTAs |
| `/login` | `LoginPage` | Email/password login, wrapped in `AuthLayout` |
| `/signup` | `SignupPage` | Registration with validation (name, email, password, confirm) |
| `/forgot-password` | `ForgotPasswordPage` | Email input to request reset link |
| `/reset-password` | `ResetPasswordPage` | New password form (reads `?token=` from URL) |

`AuthLayout` checks if already authenticated via `GET /auth/me` and redirects to the app dashboard if so.

### app (port 5174) — Authenticated SPA

| Route | Page | Sidebar Label |
|-------|------|---------------|
| `/dashboard` | `DashboardPage` | Dashboard |
| `/focus` | `FocusPage` | Focus |
| `/tasks` | `TasksPage` | Tasks |
| `/habits` | `HabitsPage` | Habits |
| `/notes` | `NotesPage` | Notes |
| `/learn` | `LearnPage` | Learn |
| `/learn/flashcards` | `FlashcardsPage` | Flashcards |
| `/reviews` | `ReviewsPage` | Reviews |
| `/admin/users` | `AdminUsersPage` | Admin (admin role only) |

All routes are wrapped in `AppShell` (sidebar + topbar + main area). The admin route is conditionally rendered and guarded by role check.

## State Management

### Server State: TanStack Query

Each feature has a dedicated hooks file with query + mutation hooks:

```typescript
// hooks/useTasks.ts
useTasks(filters)        // GET /tasks
useCreateTask()          // POST /tasks
useUpdateTask()          // PATCH /tasks/:id
useDeleteTask()          // DELETE /tasks/:id
```

Mutations invalidate their resource's top-level query key on success, triggering automatic refetches (e.g., `["tasks"]`, `["habits"]`, `["learn"]`).

### Client State: Zustand

| Store | File | State |
|-------|------|-------|
| `useFocusStore` | `store/useFocusStore.ts` | Timer mode (pomodoro/stopwatch), running state, elapsed/remaining, breaks, fullscreen, preselected task |
| `useUIStore` | `store/useUIStore.ts` | Sidebar open/closed |
| `useAuthStore` | `store/useAuthStore.ts` | Current user (mostly superseded by TanStack Query) |

## API Layer

Both apps use Axios with a shared configuration:

- `baseURL` set to `VITE_API_URL`
- `withCredentials: true` to send cookies
- `401` interceptor attempts token refresh via `POST /auth/refresh` before retrying the failed request
- All responses are wrapped through `apiFetch()` which handles JSON parsing and error extraction

## UI System

- **Components**: shadcn/ui library in `packages/ui/`, installed via `pnpm dlx shadcn@latest add`
- **Styling**: Tailwind CSS v4 with CSS variables for theming
- **Theme**: Light/dark toggle persisted to localStorage, respects `prefers-color-scheme`
- **Toasts**: Sonner for notifications
- **Charts**: Recharts for dashboard charts (habit bar chart, productivity chart)
- **Rich Text**: Tiptap editor for task descriptions and notes
- **Icons**: Lucide React

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Quick add task (global modal) |
| `Cmd/Ctrl + P` | Command palette — fuzzy search across all pages (Fuse.js) |
| `Escape` | Close modals |

## Build

```bash
cd frontend
pnpm build    # Turbo builds all apps and packages
```

The build outputs are in `apps/*/dist/` and can be served by any static file server.
