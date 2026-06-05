import { Navigate, Outlet } from "react-router-dom"

import { Sidebar } from "@/components/Sidebar"
import { TopBar } from "@/components/TopBar"
import { useCurrentUser } from "@/hooks/useAuth"

export function AppShell() {
  const { isLoading, isError } = useCurrentUser()

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (isError) {
    return <Navigate replace to="/login" />
  }

  return (
    <div className="flex min-h-svh bg-muted/30">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
