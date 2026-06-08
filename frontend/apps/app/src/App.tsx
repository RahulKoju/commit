import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom"

import { AppShell } from "@/components/AppShell"
import { AdminUsersPage } from "@/pages/AdminUsersPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { FocusPage } from "@/pages/FocusPage"
import { HabitsPage } from "@/pages/HabitsPage"
import { FlashcardsPage } from "@/pages/FlashcardsPage"
import { LearnPage } from "@/pages/LearnPage"
import { LoginRedirectPage } from "@/pages/LoginRedirectPage"
import { NotesPage } from "@/pages/NotesPage"
import { ReviewsPage } from "@/pages/ReviewsPage"
import { TasksPage } from "@/pages/TasksPage"

const router = createBrowserRouter([
  { path: "/login", element: <LoginRedirectPage /> },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate replace to="/dashboard" /> },
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/focus", element: <FocusPage /> },
      { path: "/tasks", element: <TasksPage /> },
      { path: "/habits", element: <HabitsPage /> },
      { path: "/notes", element: <NotesPage /> },
      { path: "/learn", element: <LearnPage /> },
      { path: "/learn/flashcards", element: <FlashcardsPage /> },
      { path: "/reviews", element: <ReviewsPage /> },
      { path: "/admin/users", element: <AdminUsersPage /> },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
