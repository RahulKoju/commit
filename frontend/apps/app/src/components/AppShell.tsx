import { X } from "lucide-react"
import { useEffect, useState } from "react"
import { Outlet } from "react-router-dom"
import { Button } from "@workspace/ui/components/button"

import { Sidebar } from "@/components/Sidebar"
import { TopBar } from "@/components/TopBar"
import { useCurrentUser } from "@/hooks/useAuth"
import { TaskForm } from "@/pages/TasksPage"

export function AppShell() {
  const { isLoading, isError } = useCurrentUser()
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setQuickAddOpen(true)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-destructive">
        Unable to connect to the server. Please try again later.
      </div>
    )
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
      {quickAddOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl border bg-background p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Quick add task</h2>
                <p className="text-sm text-muted-foreground">Create a task from anywhere.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Close quick add"
                onClick={() => setQuickAddOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <TaskForm onDone={() => setQuickAddOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
